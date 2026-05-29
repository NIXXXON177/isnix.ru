#!/usr/bin/env python3
import re
import zipfile
from pathlib import Path

jar = Path(__file__).resolve().parents[1] / "server-remote/mods/open-parties-and-claims-fabric-1.21.1-0.26.3.jar"
data = zipfile.ZipFile(jar).read("xaero/pac/common/server/config/ServerConfig.class")
# UTF-8 constant pool strings in class file
text = data.decode("latin-1", errors="ignore")
opts = set(re.findall(r"(?:party|claims)\.[a-zA-Z0-9_.-]+", text))
for o in sorted(opts):
    print(o)
