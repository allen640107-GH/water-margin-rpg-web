# 產生標題字型子集：python3 tools/make_font.py （需要 fontTools：/workspace/fontvenv）
import re, glob, subprocess, os
chars = set('水滸傳替天行道第回全劇終勝敗乃兵家常事大俠請重新來過梁山泊聚義廳選單0123456789・！？，。：「」…—')
for f in glob.glob('js/**/*.js', recursive=True):
    s = open(f, encoding='utf-8').read()
    for m in re.finditer(r"^\s*([^\s|@/`'\"]{1,10})\|", s, re.M): chars |= set(m.group(1))
    for m in re.finditer(r"(?:name|title|sub|label): '([^']*)'", s): chars |= set(m.group(1))
    for m in re.finditer(r"@(?:title|chapter) (.*)", s): chars |= set(m.group(1))
    for m in re.finditer(r"caption\(([^;]*)", s): chars |= set(re.sub(r'[\x00-\x7f]', '', m.group(1)))
chars = {c for c in chars if ord(c) > 32}
open('/tmp/title_chars.txt', 'w', encoding='utf-8').write(''.join(sorted(chars)))
src = '/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc'
if not os.path.exists(src):
    src = subprocess.check_output(['fc-match', '-f', '%{file}', 'Noto Serif CJK TC:bold']).decode()
subprocess.check_call(['/workspace/fontvenv/bin/pyftsubset', src, '--font-number=' + ('3' if src.endswith('.ttc') else '0'),
    '--text-file=/tmp/title_chars.txt', '--flavor=woff2', '--output-file=fonts/title.woff2', '--layout-features=*', '--no-hinting'])
print(len(chars), 'chars ->', os.path.getsize('fonts/title.woff2'), 'bytes')
