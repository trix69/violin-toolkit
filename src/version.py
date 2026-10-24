"""App version helpers shared by release.py and make_pwa.py. Versions step by 0.01: 1.0, 1.01 ... 1.99, 2.0."""
import os
FILE = os.path.dirname(os.path.abspath(__file__)) + '/VERSION'

def current():
    return open(FILE).read().strip()

def bumped(v):
    major, _, minor = v.partition('.')
    n = int(major) * 100 + int(minor.ljust(2, '0')) + 1
    return '%d.%s' % (n // 100, '0' if n % 100 == 0 else '%02d' % (n % 100))
