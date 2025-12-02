#!/usr/bin/env python3
"""
File size audit script - identifies files exceeding size limits
Run before committing to enforce 500-line maximum per file
"""
import os
from pathlib import Path
from typing import List, Tuple

# Configuration
MAX_LINES = 500
WARN_LINES = 400
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
            
            if line_count > MAX_LINES:
                violations.append((filepath.relative_to(ROOT), line_count))
            elif line_count > WARN_LINES:
                warnings.append((filepath.relative_to(ROOT), line_count))
    
    return sorted(violations, key=lambda x: x[1], reverse=True), \
           sorted(warnings, key=lambda x: x[1], reverse=True)

def print_report(violations: List[Tuple[Path, int]], warnings: List[Tuple[Path, int]]):
    """Print audit report"""
    print("=" * 80)
    print("FILE SIZE AUDIT REPORT")
    print("=" * 80)
    print(f"Maximum allowed: {MAX_LINES} lines")
    print(f"Warning threshold: {WARN_LINES} lines")
    print()
    
    if violations:
        print(f"❌ VIOLATIONS ({len(violations)} files exceed {MAX_LINES} lines):")
        print("-" * 80)
        for filepath, lines in violations:
            overage = lines - MAX_LINES
            print(f"  {filepath}")
            print(f"    Lines: {lines} (over by {overage})")
        print()
    
    if warnings:
        print(f"⚠️  WARNINGS ({len(warnings)} files between {WARN_LINES}-{MAX_LINES} lines):")
        print("-" * 80)
        for filepath, lines in warnings:
            print(f"  {filepath}")
            print(f"    Lines: {lines}")
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
        print("  Refactor files exceeding 500 lines before committing.")
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
