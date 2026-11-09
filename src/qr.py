"""A small QR code encoder (byte mode, error correction M, versions 1-6), for the Fingerings page's QR
(Trix): the app's address, drawn as vector squares in the PDF. No library: build.py runs it once.

qr_matrix(text) -> list of rows of 0/1 (no quiet zone); qr_svg_path(text) -> SVG path data, one unit per module.
"""

# version: (total codewords, ecc codewords per block, blocks), by error-correction level (only versions whose
# blocks are all the same length); alignment pattern centres
_TAB = {'M': {1: (26, 10, 1), 2: (44, 16, 1), 3: (70, 26, 1), 4: (100, 18, 2), 5: (134, 24, 2), 6: (172, 16, 4)},
        'Q': {1: (26, 13, 1), 2: (44, 22, 1), 3: (70, 18, 2), 4: (100, 26, 2), 6: (172, 24, 4)}}
_LEVEL_BITS = {'L': 1, 'M': 0, 'Q': 3, 'H': 2}
_ALIGN = {1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34]}

_EXP = [0] * 512
_LOG = [0] * 256
_x = 1
for _i in range(255):
    _EXP[_i] = _x
    _LOG[_x] = _i
    _x <<= 1
    if _x & 0x100:
        _x ^= 0x11D
for _i in range(255, 512):
    _EXP[_i] = _EXP[_i - 255]


def _gmul(a, b):
    return 0 if a == 0 or b == 0 else _EXP[_LOG[a] + _LOG[b]]


def _rs(data, n):
    gen = [1]
    for i in range(n):   # (x - a^0)(x - a^1)...
        gen = [(gen[j] if j < len(gen) else 0) ^ (_gmul(gen[j - 1], _EXP[i]) if j > 0 else 0) for j in range(len(gen) + 1)]
    rem = [0] * n
    for d in data:
        f = d ^ rem[0]
        rem = rem[1:] + [0]
        for j in range(n):
            rem[j] ^= _gmul(gen[j + 1], f)
    return rem


def _codewords(text, ver, level):
    total, ecn, blocks = _TAB[level][ver]
    data_n = total - ecn * blocks
    raw = text.encode('utf-8')
    bits = '0100' + format(len(raw), '08b') + ''.join(format(b, '08b') for b in raw)
    if len(bits) > data_n * 8:
        return None
    bits += '0' * min(4, data_n * 8 - len(bits))
    bits += '0' * (-len(bits) % 8)
    data = [int(bits[i:i + 8], 2) for i in range(0, len(bits), 8)]
    pad = [0xEC, 0x11]
    while len(data) < data_n:
        data.append(pad[(len(data) - len(bits) // 8) % 2])
    # split into blocks (all the same length up to version 6 at level M), interleave data then ecc
    size = data_n // blocks
    bl = [data[i * size:(i + 1) * size] for i in range(blocks)]
    ec = [_rs(b, ecn) for b in bl]
    out = []
    for i in range(size):
        out += [b[i] for b in bl]
    for i in range(ecn):
        out += [e[i] for e in ec]
    return out


def _format_bits(mask, level):
    d = (_LEVEL_BITS[level] << 3) | mask
    v = d << 10
    g = 0b10100110111
    for i in range(14, 9, -1):
        if v & (1 << i):
            v ^= g << (i - 10)
    return ((d << 10) | v) ^ 0b101010000010010


def _build(ver, cw, mask, level):
    n = 17 + 4 * ver
    m = [[None] * n for _ in range(n)]

    def finder(r, c):
        for i in range(-1, 8):
            for j in range(-1, 8):
                if 0 <= r + i < n and 0 <= c + j < n:
                    on = 0 <= i <= 6 and 0 <= j <= 6 and (i in (0, 6) or j in (0, 6) or (2 <= i <= 4 and 2 <= j <= 4))
                    m[r + i][c + j] = 1 if on else 0
    finder(0, 0); finder(0, n - 7); finder(n - 7, 0)
    for i in range(8, n - 8):
        m[6][i] = m[i][6] = 1 if i % 2 == 0 else 0
    al = _ALIGN[ver]
    for r in al:
        for c in al:
            if m[r][c] is not None:
                continue
            for i in range(-2, 3):
                for j in range(-2, 3):
                    m[r + i][c + j] = 1 if max(abs(i), abs(j)) != 1 else 0
    m[n - 8][8] = 1   # the dark module
    # format bits, bit i (least significant first) at (row, col): ISO 18004 layout
    fmt = [(i, 8) for i in range(6)] + [(7, 8), (8, 8), (8, 7)] + [(8, 14 - i) for i in range(9, 15)]
    fmt2 = [(8, n - 1 - i) for i in range(8)] + [(n - 15 + i, 8) for i in range(8, 15)]
    for (r, c) in fmt + fmt2:
        if m[r][c] is None:
            m[r][c] = 0   # reserved, written below
    bits = ''.join(format(b, '08b') for b in cw)
    k = 0
    c = n - 1
    up = True
    while c > 0:
        if c == 6:
            c -= 1
        for t in range(n):
            r = n - 1 - t if up else t
            for cc in (c, c - 1):
                if m[r][cc] is None:
                    b = int(bits[k]) if k < len(bits) else 0
                    k += 1
                    if [(r + cc) % 2 == 0, r % 2 == 0, cc % 3 == 0, (r + cc) % 3 == 0, (r // 2 + cc // 3) % 2 == 0,
                            (r * cc) % 2 + (r * cc) % 3 == 0, ((r * cc) % 2 + (r * cc) % 3) % 2 == 0,
                            ((r + cc) % 2 + (r * cc) % 3) % 2 == 0][mask]:
                        b ^= 1
                    m[r][cc] = b
        up = not up
        c -= 2
    f = _format_bits(mask, level)
    fb = [(f >> i) & 1 for i in range(15)]
    for i, (r, cc) in enumerate(fmt):
        m[r][cc] = fb[i]
    for i, (r, cc) in enumerate(fmt2):
        m[r][cc] = fb[i]
    return m


def _penalty(m):
    n = len(m)
    p = 0
    for rows in (m, [list(x) for x in zip(*m)]):
        for row in rows:
            run = 1
            for i in range(1, n):
                if row[i] == row[i - 1]:
                    run += 1
                else:
                    if run >= 5:
                        p += run - 2
                    run = 1
            if run >= 5:
                p += run - 2
            s = ''.join(map(str, row))
            p += 40 * (s.count('10111010000') + s.count('00001011101'))
    for r in range(n - 1):
        for c in range(n - 1):
            if m[r][c] == m[r + 1][c] == m[r][c + 1] == m[r + 1][c + 1]:
                p += 3
    dark = sum(map(sum, m)) * 100 // (n * n)
    p += abs(dark - 50) // 5 * 10
    return p


def qr_matrix(text, level='M'):
    for ver in sorted(_TAB[level]):
        cw = _codewords(text, ver, level)
        if cw is not None:
            return min((_build(ver, cw, mk, level) for mk in range(8)), key=_penalty)
    raise ValueError('text too long for this small encoder')


def qr_svg_path(text, level='M'):
    """Dark modules as one path, a run of modules in a row per rectangle (one unit per module)."""
    m = qr_matrix(text, level)
    d = []
    for r, row in enumerate(m):
        c = 0
        while c < len(row):
            if row[c]:
                s = c
                while c < len(row) and row[c]:
                    c += 1
                d.append('M%d %dh%dv1h-%dz' % (s, r, c - s, c - s))
            else:
                c += 1
    return len(m), ''.join(d)


if __name__ == '__main__':
    import sys
    for row in qr_matrix(sys.argv[1] if len(sys.argv) > 1 else 'https://trix69.github.io/violin-toolkit/'):
        print(''.join('##' if v else '  ' for v in row))
