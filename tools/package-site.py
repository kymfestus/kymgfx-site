#!/usr/bin/env python3
"""Copy only web files for deployment, or write a ZIP with index.html at its root."""
import argparse, shutil, zipfile
from pathlib import Path
from site_tools import ROOT, web_files, stamp_pages
parser = argparse.ArgumentParser(description=__doc__)
group = parser.add_mutually_exclusive_group(required=True)
group.add_argument('--output', type=Path, help='New/empty output folder')
group.add_argument('--zip', type=Path, help='Output web-only ZIP')
args = parser.parse_args()
stamp_pages()
if args.output:
    dest = args.output.resolve()
    if dest == ROOT or ROOT.is_relative_to(dest): parser.error('Output cannot contain the source folder')
    if dest.exists() and any(dest.iterdir()): parser.error('Output must be a new or empty folder')
    dest.mkdir(parents=True, exist_ok=True)
    for source in web_files():
        target = dest / source.relative_to(ROOT); target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
    print('Deployment files copied to ' + str(dest))
else:
    with zipfile.ZipFile(args.zip, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for source in web_files(): z.write(source, source.relative_to(ROOT))
    print('Upload ZIP written to ' + str(args.zip))
