#!/usr/bin/env python3
"""
File size audit script - identifies files exceeding size limits
Run before committing to enforce 500-line maximum per file
"""
import os
from pathlib import Path
from typing import List, Tuple

# Configuration
DEFAULT_MAX_LINES = 500
DEFAULT_WARN_LINES = 400

# Directory-specific thresholds (path substring -> {max, warn})
# e.g. tests can be larger because E2E suites are often long
DIR_OVERRIDES = {
    'tests': {'max': 900, 'warn': 800},
}
ROOT = Path(__file__).parent.parent

# Directories to check
INCLUDE_DIRS = ['src', 'scripts', 'tests', 'docs', '.github']

# File extensions to check
EXTENSIONS = ['.ts', '.js', '.py', '.md', '.yml', '.yaml', '.json']

# Files to exclude
EXCLUDE_PATTERNS = [
    'node_modules',
    '.git',
    'dist',
    'build',
    'coverage',
    'models',
    'datasets',
    'backups',
    'pnpm-lock.yaml',
    'package-lock.json',
    '.pnpm',
    '__pycache__'
]

def should_check(filepath: Path) -> bool:
    """Determine if file should be checked"""
    if filepath.suffix not in EXTENSIONS:
        return False
    
    for pattern in EXCLUDE_PATTERNS:
        if pattern in str(filepath):
            return False
    
    return True

def count_lines(filepath: Path) -> int:
    """Count non-empty lines in file"""
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            return sum(1 for line in f if line.strip())
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return 0

def audit_files() -> Tuple[List[Tuple[Path, int]], List[Tuple[Path, int]]]:
    """Audit all files and return violations and warnings"""
    violations = []  # > MAX_LINES
    warnings = []    # > WARN_LINES but <= MAX_LINES
    
    for dir_name in INCLUDE_DIRS:
        dir_path = ROOT / dir_name
        if not dir_path.exists():
            continue
        
        for filepath in dir_path.rglob('*'):
            if not filepath.is_file():
                continue
            
            if not should_check(filepath):
                continue
            
            line_count = count_lines(filepath)
            
            # Determine applicable thresholds (allow per-directory overrides)
            max_lines = DEFAULT_MAX_LINES
            warn_lines = DEFAULT_WARN_LINES
            for subdir, limits in DIR_OVERRIDES.items():
                if subdir in str(filepath):
                    max_lines = limits.get('max', max_lines)
                    warn_lines = limits.get('warn', warn_lines)
                    break

                    if line_count > max_lines:
                        violations.append((filepath.relative_to(ROOT), line_count, max_lines))
                    elif line_count > warn_lines:
                        warnings.append((filepath.relative_to(ROOT), line_count, warn_lines))
    
    return sorted(violations, key=lambda x: x[1], reverse=True), \
           sorted(warnings, key=lambda x: x[1], reverse=True)

def print_report(violations: List[Tuple[Path, int, int]], warnings: List[Tuple[Path, int, int]]):
    """Print audit report"""
    print("=" * 80)
    print("FILE SIZE AUDIT REPORT")
    print("=" * 80)
    print(f"Default maximum allowed: {DEFAULT_MAX_LINES} lines")
    print(f"Default warning threshold: {DEFAULT_WARN_LINES} lines")
    if DIR_OVERRIDES:
        print("Per-directory overrides:")
        for d, limits in DIR_OVERRIDES.items():
            print(f"  {d}: max={limits.get('max')} warn={limits.get('warn')}")
    print()
    
    if violations:
        print(f"❌ VIOLATIONS ({len(violations)} files exceed their maximum lines):")
        print("-" * 80)
        for filepath, lines, applicable in violations:
            overage = lines - applicable
            print(f"  {filepath}")
            print(f"    Lines: {lines} (over by {overage}) - limit: {applicable}")
        print()
    
    if warnings:
        print(f"⚠️  WARNINGS ({len(warnings)} files exceeding their warning thresholds):")
        print("-" * 80)
        for filepath, lines, applicable in warnings:
            print(f"  {filepath}")
            print(f"    Lines: {lines} (warning threshold: {applicable})")
        print()
    
    if not violations and not warnings:
        print("✅ All files comply with size limits!")
        print()
    
    # Summary
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Violations: {len(violations)}")
    print(f"Warnings: {len(warnings)}")
    print()
    
    if violations:
        print("ACTION REQUIRED:")
        print("  Refactor files exceeding their maximum line limits before committing.")
        print("  See docs/CODING_STANDARDS.md for refactoring guidance.")
        return 1
    elif warnings:
        print("RECOMMENDED:")
        print("  Consider refactoring files approaching the 500-line limit.")
        return 0
    else:
        print("Status: PASSING")
        return 0

def main():
    violations, warnings = audit_files()
    exit_code = print_report(violations, warnings)
    exit(exit_code)

if __name__ == '__main__':
    main()
