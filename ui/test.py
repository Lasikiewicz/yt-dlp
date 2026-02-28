import sys, json, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import yt_dlp

ydl_opts = {'extract_flat': True, 'quiet': True}
with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    info = ydl.extract_info('https://www.youtube.com/@AGoldAdventure', download=False)
    
entries = info.get('entries', [])
dump_data = []
for e in entries:
    dump_data.append({
        'title': e.get('title'),
        'url': e.get('url'),
        '_type': e.get('_type'),
        'id': e.get('id')
    })
    
with open('test_dump.json', 'w') as f:
    json.dump(dump_data, f, indent=2)
