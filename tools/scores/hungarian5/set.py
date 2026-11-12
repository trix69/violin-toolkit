import sys,re
p=sys.argv[1]+'/tokens.txt'; L=open(p).read().splitlines(); idx={re.match(r'(P\d \d+):',l).group(1):i for i,l in enumerate(L)}
for ln in sys.stdin:
    ln=ln.strip()
    if not ln: continue
    k,v=ln.split(':',1); L[idx[k.strip()]]=k.strip()+': '+v.strip()
open(p,'w').write('\n'.join(L)+'\n')
