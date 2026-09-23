#!/usr/bin/env python3
import json
import sys

out = {
    'python': sys.version.split()[0],
}

try:
    import yaml
    out['pyyaml'] = getattr(yaml, '__version__', 'ok')
except Exception as exc:
    out['pyyaml_error'] = str(exc)

try:
    import requests
    out['requests'] = getattr(requests, '__version__', 'ok')
except Exception as exc:
    out['requests_error'] = str(exc)

if sys.version_info < (3, 11):
    out['python_error'] = 'Generic worker requires Python 3.11+'

print(json.dumps(out))
if any(key.endswith('_error') for key in out):
    sys.exit(1)
