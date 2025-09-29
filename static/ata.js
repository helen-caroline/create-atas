document.getElementById('ataForm').onsubmit = async function(e) {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    form.querySelector('button[type="submit"]').disabled = true;
    
    // Hide both result and placeholder during loading
    document.getElementById('ataResult').style.display = 'none';
    document.getElementById('resultPlaceholder').style.display = 'none';
    
    let data;
    try {
        const res = await fetch('/gerar_ata', { method: 'POST', body: fd });
        data = await res.json();
        if (!res.ok) {
            const err = data && data.error ? data.error : `HTTP ${res.status}`;
            showError(err);
            form.querySelector('button[type="submit"]').disabled = false;
            return;
        }
    } catch (err) {
        showError(err.message || String(err));
        form.querySelector('button[type="submit"]').disabled = false;
        return;
    }
    // Pass form values so we can construct a deterministic filename
    const formData = {
        data: form.querySelector('#data').value,
        requerimento: form.querySelector('#requerimento').value,
        titulo_issue: form.querySelector('#titulo_issue').value
    };
        // Use backend-extracted fields when available
        preencherCamposSeparados(data.ata, formData, data.titulo, data.proximos, data.corpo);
    
    // Show result and hide placeholder
    document.getElementById('ataResult').style.display = 'block';
    document.getElementById('resultPlaceholder').style.display = 'none';
    form.querySelector('button[type="submit"]').disabled = false;
};

    function limparTexto(str) {
        return (str || '').replace(/\r/g, '').trim();
    }

    function showError(msg) {
        const el = document.getElementById('ataError');
        if (!el) return;
        el.textContent = msg;
        el.style.display = 'block';
        // hide result area and show placeholder when there's an error
        document.getElementById('ataResult').style.display = 'none';
        document.getElementById('resultPlaceholder').style.display = 'flex';
    }

    // Extract title from several possible formats:
    // - "Título: ..."
    // - a heading like "Título da ATA" followed by the actual title on the next line
    // - fallback: first plausible short line after a 'Título' heading
    function extrairTituloDaAta(text) {
        if (!text) return '';
        const normalized = text.replace(/\r/g, '');

        // 1) Título: Some title
        let m = normalized.match(/(?:^|\n)\s*(t[ií]tulo|title)\s*:\s*(.+)/i);
        if (m) return m[2].split(/\n/)[0].trim();

        // 2) Heading 'Título da ATA' (or 'Título da Ata') followed by a non-empty line with the title
        m = normalized.match(/(?:^|\n)\s*(t[ií]tulo(?:\s+da\s+ata)?|title(?:\s+of\s+the\s+ata)?)\s*(?:\n)+\s*(.+)/i);
        if (m) return m[2].split(/\n/)[0].trim();

        // 3) Some generators put 'Título da ATA' and then 'Sessão ...' on the same block; try to find a short line that looks like a title
        const lines = normalized.split(/\n+/).map(s => s.trim()).filter(Boolean);
        for (let i = 0; i < lines.length; i++) {
            if (/^t[ií]tulo(?:\s+da\s+ata)?$/i.test(lines[i]) && lines[i+1]) {
                return lines[i+1].trim();
            }
        }

        return '';
    }

    // Extract the "Próximos passo(s)" section. Accepts label with or without colon and captures until blank line or end.
    function extrairProximosPassosDaAta(text) {
        if (!text) return '';
        const normalized = text.replace(/\r/g, '');
        const re = /(?:^|\n)\s*(pr[oó]ximos?\s+passo?s?)\s*:?[\s\n]*([\s\S]*?)(?=(\n\s*\n)|$)/i;
        const m = normalized.match(re);
        if (m) return m[2].trim();
        // Sometimes generator writes 'Próximos passo' followed by lines starting with a dash; try a less strict search
        const re2 = /(?:^|\n)\s*(pr[oó]ximos?\s+passo?s?)\s*(?:\n)([\s\S]*?)(?=(\n\s*\n)|$)/i;
        const m2 = normalized.match(re2);
        if (m2) return m2[2].trim();
        return '';
    }

    function construirNomeArquivo(formData, titulo) {
        // Normalize parts and avoid duplicating "Atividade do dia"
        const req = limparTexto(formData.requerimento) || '0000';
        const data = limparTexto(formData.data) || '';
        // Format date for filename as DD-MM-YYYY when possible
        function formatToDDMMYYYY(s) {
            if (!s) return '';
            s = s.trim();
            // ISO YYYY-MM-DD
            if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
                const parts = s.split('-');
                return `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
            // DD/MM/YYYY or D/M/YYYY
            const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (m) {
                const dd = String(Number(m[1])).padStart(2,'0');
                const mm = String(Number(m[2])).padStart(2,'0');
                return `${dd}-${mm}-${m[3]}`;
            }
            // Try parsing via Date as fallback
            const parsed = new Date(s);
            if (!isNaN(parsed)) {
                const dd = String(parsed.getDate()).padStart(2,'0');
                const mm = String(parsed.getMonth()+1).padStart(2,'0');
                const yyyy = parsed.getFullYear();
                return `${dd}-${mm}-${yyyy}`;
            }
            return s;
        }
        const dataForName = formatToDDMMYYYY(data);
        // Prefer explicit user-provided issue title when available
        let userTitle = limparTexto(formData.titulo_issue);
        let t = userTitle || limparTexto(titulo) || 'Atividade do dia';
        // If title already contains the phrase, don't duplicate
        t = t.replace(/^Atividade do dia\s*-?\s*/i, '').trim();

        // Try to extract bracketed tags like [CINEMAX] from the userTitle.
        // If there are multiple tags, prefer the first one that is NOT Copilot.
        let tag = '';
        if (userTitle) {
            // Find all bracketed tags
            const allTags = userTitle.match(/\[[^\]]+\]/g) || [];
            // Filter out any tag that mentions 'copilot'
            const usefulTags = allTags.filter(tg => !/copilot/i.test(tg));
            if (usefulTags.length > 0) {
                tag = usefulTags[0];
            } else if (allTags.length > 0) {
                // Only Copilot-like tags present, ignore them (don't use Copilot)
                tag = '';
            }
            // Remove all bracketed tags from visible title to avoid duplication
            t = t.replace(/\s*\[[^\]]+\]\s*/g, '').trim();
        }
        const tagPart = tag ? `[ATA]${tag}` : `[ATA]`;
        // Remove stray 'Copilot' words if any
        t = t.replace(/\bCopilot\b/ig, '').replace(/\s+/g, ' ').trim();
        return `${req} - ${tagPart} ${t} - Atividade do dia ${dataForName}`;
    }

    function preencherCamposSeparados(ata, formData) {
        ata = limparTexto(ata);

        // Nome do arquivo: construir a partir do requerimento e do título da issue
        const nomeArquivo = construirNomeArquivo(formData, '');
        const nomeEl = document.getElementById('nomeArquivo');
        if (nomeEl) nomeEl.textContent = nomeArquivo;
            // Use backend-provided title/proximos/corpo when present, otherwise fallback to client extraction
            const tituloEl = document.getElementById('tituloAta');
            const tituloFinal = (arguments.length >= 3 && arguments[2]) ? arguments[2] : extrairTituloDaAta(ata);
            if (tituloEl) tituloEl.textContent = tituloFinal || '';

            const proxEl = document.getElementById('proximosPassos');
            const proximosFinal = (arguments.length >= 4 && arguments[3]) ? arguments[3] : extrairProximosPassosDaAta(ata);
            if (proxEl) proxEl.textContent = proximosFinal || '';

        // ATA completa: show raw text (trimmed of leading/trailing whitespace)
        const ataEl = document.getElementById('ataText');
        if (ataEl) {
            // Prefer extracting the main body starting at 'Objetivo:' if present
            const corpoBackend = (arguments.length >= 5 && arguments[4]) ? arguments[4] : '';
            const corpo = corpoBackend || extrairCorpoPrincipalDaAta(ata);
            // Determine title: backend-provided (arg 3) or client-extracted
            const tituloFinal = (arguments.length >= 3 && arguments[2]) ? arguments[2] : extrairTituloDaAta(ata);
            // Build the final text: include title at top if present
            const parts = [];
            if (tituloFinal) parts.push(tituloFinal);
            const mainBody = (corpo || ata).trim();
            if (mainBody) parts.push(mainBody);
            // Append 'Próximos passos' when available (either from backend arg or extracted)
            if (proximosFinal) {
                // normalize spacing and add a heading for clarity
                const proxText = proximosFinal.trim();
                if (proxText) parts.push(`Próximos passos:\n${proxText}`);
            }
            ataEl.textContent = parts.join('\n\n').trim();
        }
    }

    // Extract main body starting at 'Objetivo:' (or 'Objetivo') until the next top-level section
    // Captures from the first occurrence of 'Objetivo' label to either a double line break or end.
    function extrairCorpoPrincipalDaAta(text) {
        if (!text) return '';
        const normalized = text.replace(/\r/g, '');
        // Capture from 'Objetivo:' until the next 'Próximos' section (or end of text).
        const re = /(?:^|\n)\s*objetivo\s*:?\s*([\s\S]*?)(?=(?:\n\s*(?:pr[oó]ximos?\b)|$))/i;
        const m = normalized.match(re);
        if (m && m[1]) {
            return `Objetivo:\n${m[1].trim()}`;
        }
        return '';
    }

    async function copyCampo(id) {
        const el = document.getElementById(id);
        const text = el ? el.textContent || '' : '';
        try {
            await navigator.clipboard.writeText(text);
            showToast('Copiado');
        } catch (err) {
            console.warn('copy failed', err);
            showToast('Falha ao copiar');
        }
    }

async function copyAta() {
    const el = document.getElementById('ataText');
    const text = el ? el.textContent || '' : '';
    try {
        await navigator.clipboard.writeText(text);
        showToast('Copiado');
    } catch (err) {
        console.warn('copy failed', err);
        showToast('Falha ao copiar');
    }
}

// Simple toast helper
function showToast(message, ms = 1600) {
    try {
        let el = document.getElementById('toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'toast';
            document.body.appendChild(el);
        }
        el.textContent = message;
        el.style.display = 'block';
        // reflow to allow transition
        void el.offsetWidth;
        el.classList.add('show');
        clearTimeout(el._hideTimeout);
        el._hideTimeout = setTimeout(() => {
            el.classList.remove('show');
            // wait for transition end then hide
            setTimeout(() => { el.style.display = 'none'; }, 200);
        }, ms);
    } catch (e) {
        // fail silently
        console.warn('toast failed', e);
    }
}
// Normalize server-provided date into YYYY-MM-DD for input[type=date]
(function(){
    try {
        const el = document.getElementById('data');
        if (!el) return;
        let v = el.value && el.value.trim();
        // If empty, set to today
        function toYMD(d){
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth()+1).padStart(2,'0');
            const dd = String(d.getDate()).padStart(2,'0');
            return `${yyyy}-${mm}-${dd}`;
        }
        if (!v) { el.value = toYMD(new Date()); return; }
        // If already in ISO format YYYY-MM-DD, keep it
        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { return; }
        // Try DD/MM/YYYY or D/M/YYYY
        const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (m) {
            const dd = Number(m[1]);
            const mm = Number(m[2]);
            const yyyy = Number(m[3]);
            const d = new Date(yyyy, mm-1, dd);
            if (!isNaN(d)) el.value = toYMD(d);
            return;
        }
        // Try common verbose formats like '22 de setembro de 2025'
        const m2 = v.match(/(\d{1,2}).*?(\d{4})$/);
        if (m2) {
            // attempt Date.parse fallback
            const parsed = new Date(v);
            if (!isNaN(parsed)) el.value = toYMD(parsed);
            return;
        }
        // As a last resort, set today
        el.value = toYMD(new Date());
    } catch(e){ console.warn('date normalize failed', e); }
})();