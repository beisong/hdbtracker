"""Make scripts/ importable as top-level modules (the scripts aren't a package).

Importing a script is side-effect free: each guards main() behind `if __name__ == '__main__'`.
"""
import os
import sys

SCRIPTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'scripts'))
if SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, SCRIPTS_DIR)
