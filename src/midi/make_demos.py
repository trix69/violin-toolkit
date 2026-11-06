"""Writes the MIDI player's demo tunes (public-domain melodies, one violin track each):
twinkle.mid (Twinkle, Twinkle, Little Star in A major, as in Suzuki book 1) and ode.mid (Ode to Joy in D major).
Run: python3 src/midi/make_demos.py. build.py embeds the .mid files in the page."""
import os, struct

HERE = os.path.dirname(os.path.abspath(__file__))
TPQ = 480

def vlq(n):
    out = [n & 0x7F]
    n >>= 7
    while n:
        out.insert(0, (n & 0x7F) | 0x80)
        n >>= 7
    return bytes(out)

def track(name, bpm, sharps, notes):
    """notes: (midi, beats) pairs; midi None = rest. 4/4, quarter-note beats."""
    ev = bytearray()
    ev += vlq(0) + b'\xff\x03' + vlq(len(name)) + name.encode()
    ev += vlq(0) + b'\xff\x51\x03' + struct.pack('>I', round(60000000 / bpm))[1:]
    ev += vlq(0) + b'\xff\x58\x04\x04\x02\x18\x08'
    ev += vlq(0) + b'\xff\x59\x02' + struct.pack('bB', sharps, 0)
    ev += vlq(0) + b'\xc0\x28'   # program 41: violin
    wait = 0
    for m, beats in notes:
        ticks = round(beats * TPQ)
        if m is None:
            wait += ticks
            continue
        gap = 24   # a short breath between notes so repeated notes are heard as two
        ev += vlq(wait) + bytes([0x90, m, 84])
        ev += vlq(ticks - gap) + bytes([0x80, m, 0])
        wait = gap
    ev += vlq(wait) + b'\xff\x2f\x00'
    return b'MTrk' + struct.pack('>I', len(ev)) + bytes(ev)

def write(fn, name, bpm, sharps, notes):
    data = b'MThd' + struct.pack('>IHHH', 6, 0, 1, TPQ) + track(name, bpm, sharps, notes)
    open(os.path.join(HERE, fn), 'wb').write(data)
    print(fn, len(data), 'bytes')

A4, B4, Cs5, D5, E5, Fs5 = 69, 71, 73, 74, 76, 78
q, h = 1, 2
twinkle = [(A4,q),(A4,q),(E5,q),(E5,q),(Fs5,q),(Fs5,q),(E5,h),
           (D5,q),(D5,q),(Cs5,q),(Cs5,q),(B4,q),(B4,q),(A4,h),
           (E5,q),(E5,q),(D5,q),(D5,q),(Cs5,q),(Cs5,q),(B4,h),
           (E5,q),(E5,q),(D5,q),(D5,q),(Cs5,q),(Cs5,q),(B4,h),
           (A4,q),(A4,q),(E5,q),(E5,q),(Fs5,q),(Fs5,q),(E5,h),
           (D5,q),(D5,q),(Cs5,q),(Cs5,q),(B4,q),(B4,q),(A4,h)]
# write('twinkle.mid', 'Twinkle, Twinkle, Little Star', 100, 3, twinkle)   # replaced by Trix's string orchestra arrangement (2026-11-07): don't overwrite it

D4, E4, Fs4, G4, A4_ = 62, 64, 66, 67, 69
line = [(Fs4,q),(Fs4,q),(G4,q),(A4_,q),(A4_,q),(G4,q),(Fs4,q),(E4,q),(D4,q),(D4,q),(E4,q),(Fs4,q)]
ode = line + [(Fs4,1.5),(E4,.5),(E4,h)] + line + [(E4,1.5),(D4,.5),(D4,h)]
# write('ode.mid', 'Ode to Joy', 108, 2, ode)   # replaced by Trix's violin + piano arrangement (2026-11-07): don't overwrite it
