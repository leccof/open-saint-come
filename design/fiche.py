#!/usr/bin/env python3
"""Fabrique la fiche à imprimer pour la table de marque.

OUTIL DE CONCEPTION — ne fait pas partie de l'application. Rien de ce fichier
ne part dans le navigateur : l'app reste sans aucune dépendance.

    python3 design/fiche.py                # fiche vierge, cases à remplir
    python3 design/fiche.py EFN9SD         # fiche d'un tournoi précis

Avec un code, le QR mène directement au tournoi : on scanne, on y est, sans
rien saisir. Sans code, il mène à l'accueil du site et les six cases sont
vides, à remplir au feutre le jour du concours.

Puis, pour produire le PDF et le PNG :

    cd design
    CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    "$CHROME" --headless=new --no-pdf-header-footer --print-to-pdf=fiche.pdf \\
              "file://$PWD/fiche.html"
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from qr import encoder, vers_chemin_svg          # noqa: E402

SITE = 'https://leccof.github.io/open-saint-come/'

GABARIT = '''<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Open de Saint-Côme — fiche de la table de marque</title>
<style>
  /* ==========================================================================
     FICHE À IMPRIMER — A4 portrait (210 × 297 mm)
     Fichier ENGENDRÉ par design/fiche.py — ne pas modifier à la main.
     Palette : Sanzo Wada, combinaison n° 296, valeurs exactes.
     ========================================================================== */

  @page { size: 210mm 297mm; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 210mm; height: 297mm;
               -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  .fiche {
    position: relative; width: 210mm; height: 297mm;
    background: #f5ecc2; color: #34454c; overflow: hidden;
    font-family: -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif;
    padding: 16mm 18mm;
  }

  .filet { height: 0.5mm; background: #71502f; }

  .titre {
    font-family: Didot, "Didot LT STD", "Bodoni 72", "Hoefler Text", Georgia, serif;
    font-size: 18mm; line-height: 0.98; letter-spacing: -0.018em;
    margin: 6mm 0 2.5mm;
  }

  .surtitre, .soustitre {
    font-size: 3.3mm; font-weight: 600;
    letter-spacing: 0.3em; text-transform: uppercase; color: #71502f;
  }

  .bloc { margin-top: 8mm; }

  .bloc__titre {
    font-family: Didot, "Bodoni 72", "Hoefler Text", Georgia, serif;
    font-size: 7.5mm; line-height: 1.1; margin-bottom: 3mm;
  }

  .rangee { display: flex; gap: 8mm; align-items: center; }

  .qr { flex: none; width: 58mm; height: 58mm; display: block; }

  .adresse { flex: 1 1 auto; font-size: 4.2mm; line-height: 1.5; }
  .adresse b {
    display: block; font-size: 5mm; letter-spacing: 0.01em;
    word-break: break-all; margin-top: 2mm;
  }

  /* --- les six caractères du code ----------------------------------------- */
  .cases { display: flex; gap: 2.6mm; margin-top: 3mm; }
  .case {
    flex: 1 1 0; height: 24mm;
    border: 0.7mm solid #71502f; border-radius: 1mm;
    display: flex; align-items: center; justify-content: center;
    font-family: Didot, "Bodoni 72", Georgia, serif;
    font-size: 14mm; line-height: 1;
  }
  .case--plein { background: #34454c; color: #f5ecc2; border-color: #34454c; }
  .aide { font-size: 3.4mm; color: #71502f; margin-top: 2.5mm; }

  .etapes { margin-top: 7mm; }
  .etape { display: flex; gap: 5mm; align-items: baseline; padding: 3mm 0;
           border-bottom: 0.3mm solid #d8a37b; }
  .etape__n {
    flex: none; width: 7mm;
    font-family: Didot, "Bodoni 72", Georgia, serif;
    font-size: 6.5mm; line-height: 1; color: #71502f;
  }
  .etape__t { font-size: 4.4mm; line-height: 1.35; }

  .pied { position: absolute; left: 18mm; right: 18mm; bottom: 13mm; }
  .pied__texte {
    display: flex; justify-content: space-between; align-items: baseline;
    margin-top: 3mm; font-size: 3.3mm; font-weight: 600;
    letter-spacing: 0.22em; text-transform: uppercase; color: #71502f;
  }
</style>
</head>
<body>
<div class="fiche">

  <div class="filet"></div>
  <div class="surtitre" style="margin-top:4mm">Table de marque</div>

  <h1 class="titre">Open<br>de Saint-Côme</h1>
  <div class="soustitre">En doublette · 15 août · Saint-Côme-d’Olt</div>

  <div class="bloc">
    <div class="bloc__titre">{TITRE_QR}</div>
    <div class="rangee">
      <svg class="qr" viewBox="0 0 {TOTAL} {TOTAL}" xmlns="http://www.w3.org/2000/svg"
           shape-rendering="crispEdges" role="img" aria-label="Code à scanner">
        <rect width="{TOTAL}" height="{TOTAL}" fill="#f5ecc2"/>
        <path d="{CHEMIN}" fill="#34454c"/>
      </svg>
      <div class="adresse">
        {TEXTE_QR}
        <b>leccof.github.io/<br>open-saint-come</b>
      </div>
    </div>
  </div>

  <div class="bloc">
    <div class="bloc__titre">Code du tournoi</div>
    <div class="cases">{CASES}</div>
    <div class="aide">{AIDE_CODE}</div>
  </div>

  <div class="etapes">
    <div class="etape"><span class="etape__n">1</span>
      <span class="etape__t">Ouvrez l’adresse ci-dessus, ou scannez le code.</span></div>
    <div class="etape"><span class="etape__n">2</span>
      <span class="etape__t">Appuyez sur « Rejoindre un tournoi » et saisissez les six caractères.</span></div>
    <div class="etape"><span class="etape__n">3</span>
      <span class="etape__t">Les équipes, les tableaux et les scores s’affichent en direct.</span></div>
  </div>

  <div class="pied">
    <div class="filet"></div>
    <div class="pied__texte">
      <span>Terrain du Potager</span>
      <span>Les règles sont dans l’application</span>
    </div>
  </div>

</div>
</body>
</html>
'''


def fabriquer(code=None):
    cible = f'{SITE}#/t/{code}' if code else SITE
    matrice, version = encoder(cible)
    total, chemin = vers_chemin_svg(matrice, marge=4)

    if code:
        cases = ''.join(f'<div class="case case--plein">{c}</div>' for c in code)
        aide = ('Ce code est déjà celui du tournoi : il n’y a rien à écrire. '
                'Le QR ci-dessus y mène directement.')
        titre_qr = 'Rejoindre le tournoi'
        texte_qr = ('Scannez ce code : le tournoi s’ouvre directement,<br>'
                    'sans rien saisir. Sinon, tapez l’adresse :')
    else:
        cases = '<div class="case"></div>' * 6
        aide = ('À écrire au feutre le jour du concours — il est affiché en haut de '
                'l’écran sur l’appareil qui a créé le tournoi.')
        titre_qr = 'Suivre le tournoi sur son téléphone'
        texte_qr = 'Scannez ce code avec l’appareil photo,<br>ou tapez l’adresse :'

    html = (GABARIT
            .replace('{TOTAL}', str(total))
            .replace('{CHEMIN}', chemin)
            .replace('{CASES}', cases)
            .replace('{AIDE_CODE}', aide)
            .replace('{TITRE_QR}', titre_qr)
            .replace('{TEXTE_QR}', texte_qr))

    sortie = Path(__file__).parent / 'fiche.html'
    sortie.write_text(html, encoding='utf-8')
    print(f'{sortie} — QR version {version} ({len(matrice)}×{len(matrice)}) vers {cible}')


if __name__ == '__main__':
    fabriquer(sys.argv[1].strip().upper() if len(sys.argv) > 1 else None)
