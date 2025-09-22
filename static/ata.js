document.getElementById('ataForm').onsubmit = async function(e) {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    form.querySelector('button[type="submit"]').disabled = true;
    document.getElementById('ataResult').style.display = 'none';
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
    document.getElementById('ataResult').style.display = 'block';
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
        // hide result area when there's an error
        document.getElementById('ataResult').style.display = 'none';
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
        return `${req} - ${tagPart} ${t} - Atividade do dia ${data}`;
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
            parts.push((corpo || ata).trim());
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

    function copyCampo(id) {
        const text = document.getElementById(id).textContent;
        navigator.clipboard.writeText(text);
    }
function copyAta() {
    const text = document.getElementById('ataText').textContent;
    navigator.clipboard.writeText(text);
}