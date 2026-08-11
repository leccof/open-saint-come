"""Encodeur QR — outil de conception, PAS un fichier de l'application.

Ce script ne part JAMAIS dans le navigateur : il sert uniquement à fabriquer
le code de la fiche à imprimer (design/fiche.html). L'application, elle, ne
contient aucun QR et n'a donc aucune dépendance de plus.

Pour regénérer la fiche avec un lien de tournoi précis :

    python3 design/qr.py "https://leccof.github.io/open-saint-come/#/t/K7M2XQ"

puis remplacer l'attribut d dans le <path> de fiche.html.

Vérifié : les codes produits sont relus correctement par le décodeur du
système (versions 1 à 5 testées, texte identique au texte encodé).

Écrit à la main : aucune bibliothèque QR n'est installée, et le projet
interdit les dépendances. L'algorithme est entièrement normalisé
(ISO/IEC 18004).

Le niveau Q corrige 25 % de modules abîmés : c'est le bon choix pour une
feuille scotchée sur une table, qui prendra le soleil et les doigts.

On s'arrête à la version 9 volontairement : à partir de la version 10, le
compteur de longueur passe de 8 à 16 bits, et gérer ce cas pour rien
compliquerait le code. La version 9 accepte déjà 132 caractères.
"""

# ---------------------------------------------------------------------------
#  version : (codets de correction par bloc, [(nombre de blocs, codets de données)])
# ---------------------------------------------------------------------------
TABLE_Q = {
    1: (13, [(1, 13)]),
    2: (22, [(1, 22)]),
    3: (18, [(2, 17)]),
    4: (26, [(2, 24)]),
    5: (18, [(2, 15), (2, 16)]),
    6: (24, [(4, 19)]),
    7: (18, [(2, 14), (4, 15)]),
    8: (22, [(4, 18), (2, 19)]),
    9: (20, [(4, 16), (4, 17)]),
}

ALIGNEMENTS = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26],
    5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46],
}

# ---------------------------------------------------------------------------
#  GF(256)
# ---------------------------------------------------------------------------
EXP, LOG = [0] * 512, [0] * 256
_x = 1
for _i in range(255):
    EXP[_i], LOG[_x] = _x, _i
    _x <<= 1
    if _x & 0x100:
        _x ^= 0x11D
for _i in range(255, 512):
    EXP[_i] = EXP[_i - 255]


def mul(a, b):
    return 0 if a == 0 or b == 0 else EXP[LOG[a] + LOG[b]]


def correction(donnees, n):
    """Les n codets de correction Reed-Solomon d'un bloc."""
    g = [1]
    for i in range(n):
        g = g + [0]
        for j in range(len(g) - 1, 0, -1):
            g[j] ^= mul(g[j - 1], EXP[i])
    reste = list(donnees) + [0] * n
    for i in range(len(donnees)):
        f = reste[i]
        if f:
            for j in range(n + 1):
                reste[i + j] ^= mul(g[j], f)
    return reste[len(donnees):]


# ---------------------------------------------------------------------------
#  Encodage des données
# ---------------------------------------------------------------------------
def choisir_version(nb_octets):
    for v in sorted(TABLE_Q):
        capacite = sum(n * d for n, d in TABLE_Q[v][1])
        if nb_octets + 2 <= capacite:      # 4 bits de mode + 8 de longueur
            return v
    raise ValueError('texte trop long (versions 1 à 9 seulement)')


def flux_de_bits(texte, version):
    octets = texte.encode('utf-8')
    ec, groupes = TABLE_Q[version]
    total = sum(n * d for n, d in groupes)

    bits = [0, 1, 0, 0]                                          # mode octet
    bits += [(len(octets) >> i) & 1 for i in range(7, -1, -1)]   # longueur
    for o in octets:
        bits += [(o >> i) & 1 for i in range(7, -1, -1)]

    bits += [0] * min(4, total * 8 - len(bits))                  # terminateur
    while len(bits) % 8:
        bits.append(0)
    bourrage = [0xEC, 0x11]
    k = 0
    while len(bits) < total * 8:
        bits += [(bourrage[k % 2] >> i) & 1 for i in range(7, -1, -1)]
        k += 1

    codets = [int(''.join(map(str, bits[i:i + 8])), 2) for i in range(0, len(bits), 8)]

    blocs, blocs_ec, pos = [], [], 0
    for nb, taille in groupes:
        for _ in range(nb):
            b = codets[pos:pos + taille]
            pos += taille
            blocs.append(b)
            blocs_ec.append(correction(b, ec))

    sortie = []
    for i in range(max(len(b) for b in blocs)):
        for b in blocs:
            if i < len(b):
                sortie.append(b[i])
    for i in range(ec):
        for b in blocs_ec:
            sortie.append(b[i])

    return [(o >> i) & 1 for o in sortie for i in range(7, -1, -1)]


# ---------------------------------------------------------------------------
#  Motifs fixes
# ---------------------------------------------------------------------------
def poser_motifs(m, version):
    n = len(m)

    def reperage(l0, c0):
        for dl in range(-1, 8):
            for dc in range(-1, 8):
                l, c = l0 + dl, c0 + dc
                if not (0 <= l < n and 0 <= c < n):
                    continue
                cadre = (dl in (0, 6) and 0 <= dc <= 6) or (dc in (0, 6) and 0 <= dl <= 6)
                noyau = 2 <= dl <= 4 and 2 <= dc <= 4
                m[l][c] = cadre or noyau

    reperage(0, 0); reperage(0, n - 7); reperage(n - 7, 0)

    for i in range(8, n - 8):                       # synchronisation
        m[6][i] = m[i][6] = (i % 2 == 0)

    for l in ALIGNEMENTS[version]:                  # alignement
        for c in ALIGNEMENTS[version]:
            if (l, c) in ((6, 6), (6, n - 7), (n - 7, 6)):
                continue
            for dl in range(-2, 3):
                for dc in range(-2, 3):
                    m[l + dl][c + dc] = max(abs(dl), abs(dc)) != 1

    m[n - 8][8] = True                              # module toujours noir

    for i in range(9):                              # réservé au format
        if m[8][i] is None: m[8][i] = False
        if m[i][8] is None: m[i][8] = False
    for i in range(8):
        if m[8][n - 1 - i] is None: m[8][n - 1 - i] = False
        if m[n - 1 - i][8] is None: m[n - 1 - i][8] = False

    if version >= 7:                                # information de version
        d = version << 12
        while d.bit_length() >= 13:
            d ^= 0x1F25 << (d.bit_length() - 13)
        mots = (version << 12) | d
        for i in range(18):
            bit = bool((mots >> i) & 1)
            m[i // 3][n - 11 + i % 3] = bit
            m[n - 11 + i % 3][i // 3] = bit


# ---------------------------------------------------------------------------
#  Données, masques, format
# ---------------------------------------------------------------------------
def poser_donnees(m, occupe, bits):
    n = len(m)
    i, montant, col = 0, True, n - 1
    while col > 0:
        if col == 6:
            col -= 1
        for l in (range(n - 1, -1, -1) if montant else range(n)):
            for dc in (0, 1):
                c = col - dc
                if occupe[l][c]:
                    continue
                m[l][c] = bool(bits[i]) if i < len(bits) else False
                i += 1
        montant = not montant
        col -= 2


MASQUES = [
    lambda l, c: (l + c) % 2 == 0,
    lambda l, c: l % 2 == 0,
    lambda l, c: c % 3 == 0,
    lambda l, c: (l + c) % 3 == 0,
    lambda l, c: (l // 2 + c // 3) % 2 == 0,
    lambda l, c: (l * c) % 2 + (l * c) % 3 == 0,
    lambda l, c: ((l * c) % 2 + (l * c) % 3) % 2 == 0,
    lambda l, c: ((l + c) % 2 + (l * c) % 3) % 2 == 0,
]

MOTIF = [True, False, True, True, True, False, True, False, False, False, False]


def penalite(m):
    n, score = len(m), 0

    for lignes in (m, [list(x) for x in zip(*m)]):
        for ligne in lignes:
            ligne = list(ligne)
            compte, prec = 1, None
            for v in ligne:
                if v == prec:
                    compte += 1
                else:
                    if compte >= 5: score += 3 + compte - 5
                    compte, prec = 1, v
            if compte >= 5: score += 3 + compte - 5
            for i in range(n - 10):                 # règle 3
                if ligne[i:i + 11] in (MOTIF, MOTIF[::-1]):
                    score += 40

    for l in range(n - 1):                          # règle 2
        for c in range(n - 1):
            if m[l][c] == m[l][c + 1] == m[l + 1][c] == m[l + 1][c + 1]:
                score += 3

    noirs = sum(1 for ligne in m for v in ligne if v)
    score += 10 * (abs(noirs * 100 // (n * n) - 50) // 5)     # règle 4
    return score


def poser_format(m, masque):
    n = len(m)
    donnees = (0b11 << 3) | masque                  # 0b11 = niveau Q
    d = donnees << 10
    while d.bit_length() >= 11:
        d ^= 0x537 << (d.bit_length() - 11)
    fmt = ((donnees << 10) | d) ^ 0x5412

    # ATTENTION — piège : les cases sont les mêmes dans les deux sens, mais
    # l'ORDRE des bits ne l'est pas. La norme fait descendre les bits 0 à 8 le
    # long de la COLONNE 8, puis courir les bits 9 à 14 le long de la LIGNE 8.
    # Les transposer donne un motif d'allure parfaitement normale, que plus
    # aucun lecteur ne sait décoder : il ne retrouve pas le masque appliqué.
    for i in range(15):
        bit = bool((fmt >> i) & 1)

        # copie 1 — autour du carré de repérage supérieur gauche
        if i <= 5:    m[i][8] = bit          # colonne 8, lignes 0 à 5
        elif i == 6:  m[7][8] = bit          # colonne 8, ligne 7
        elif i == 7:  m[8][8] = bit          # l'angle
        elif i == 8:  m[8][7] = bit          # ligne 8, colonne 7
        else:         m[8][14 - i] = bit     # ligne 8, colonnes 5 à 0

        # copie 2 — répartie le long des deux autres carrés
        if i <= 7:    m[8][n - 1 - i] = bit  # ligne 8, à droite
        else:         m[n - 15 + i][8] = bit # colonne 8, en bas


def encoder(texte):
    version = choisir_version(len(texte.encode('utf-8')))
    n = version * 4 + 17
    bits = flux_de_bits(texte, version)

    base = [[None] * n for _ in range(n)]
    poser_motifs(base, version)
    occupe = [[c is not None for c in ligne] for ligne in base]

    meilleur, meilleur_score = None, None
    for masque in range(8):
        m = [ligne[:] for ligne in base]
        poser_donnees(m, occupe, bits)
        for l in range(n):
            for c in range(n):
                if not occupe[l][c] and MASQUES[masque](l, c):
                    m[l][c] = not m[l][c]
        poser_format(m, masque)
        s = penalite(m)
        if meilleur_score is None or s < meilleur_score:
            meilleur, meilleur_score = m, s

    return meilleur, version


def vers_chemin_svg(matrice, marge=4):
    """Un unique chemin SVG, en unités « module ». Net à n'importe quelle taille."""
    n = len(matrice)
    total = n + marge * 2
    bouts = []
    for l in range(n):
        for c in range(n):
            if matrice[l][c]:
                bouts.append(f'M{c + marge} {l + marge}h1v1h-1z')
    return total, ''.join(bouts)


if __name__ == '__main__':
    import sys
    m, v = encoder(sys.argv[1])
    print(f'version {v} — {len(m)}×{len(m)} modules', file=sys.stderr)
    print('\n'.join(''.join('██' if x else '  ' for x in ligne) for ligne in m))
