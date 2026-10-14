#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_root="${1:?usage: build-designcraft-par03-ui.sh PINNED_SOURCE_CHECKOUT OUTPUT_DIR}"
output_dir="${2:?usage: build-designcraft-par03-ui.sh PINNED_SOURCE_CHECKOUT OUTPUT_DIR}"
expected='a127c6d5c3576972bbd60445f26d893db071eef3'
actual="$(git -C "$source_root" rev-parse HEAD)"
[[ "$actual" == "$expected" ]] || { echo "Expected DesignCraft $expected, found $actual" >&2; exit 2; }
[[ -z "$(git -C "$source_root" status --porcelain)" ]] || { echo 'Pinned checkout must be clean before patching' >&2; exit 2; }
patch_file="$repo_root/patches/designcraft/a127c6d5/par-03-selection-set-candidate.patch"
git -C "$source_root" apply --check "$patch_file"
git -C "$source_root" apply "$patch_file"
app="$source_root/apps/designcraft-web"
mkdir -p "$output_dir"
export PATH=/home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/toolchain/bin:$PATH
export CARGO_HOME=/home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/toolchain/cargo
export RUSTUP_HOME=/home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/toolchain/rustup
export CARGO_TARGET_DIR=/home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/target
(cd "$app" && unset NO_COLOR && python3 /home/vedran/Documents/Codex/2026-10-10/da-x20/work/tools/low-impact-build.py trunk build --release --dist "$output_dir")
printf 'Built original DesignCraft UI %s with PAR-03 Selection Tool bridge at %s\n' "$expected" "$output_dir"
