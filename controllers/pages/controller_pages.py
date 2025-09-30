from datetime import datetime

class PagesController:
    @staticmethod
    def home():
        """Lógica da página home com dashboard"""
        return {}

    @staticmethod
    def atas():
        """Lógica da página do gerador de ATAs"""
        hoje = datetime.now().strftime("%d-%m-%Y")
        return {"hoje": hoje}

    @staticmethod
    def pipeline():
        """Lógica da página de gerenciamento de pipeline"""
        return {}

    @staticmethod
    def manage_cards():
        """Lógica da página de gerenciamento de cards"""
        return {}