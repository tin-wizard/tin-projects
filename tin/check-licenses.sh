#!/usr/bin/env bash
# Fails when upstream adds files under the PolyForm Shield licence (TraceX code ported into Platform Collective)
# that are not in tin/polyform-files.txt. Review each new file, then: tin/check-licenses.sh --update
set -euo pipefail
cd "$(dirname "$0")/.."
list() { git grep -l "PolyForm" -- . ':!common/config/rush/pnpm-lock.yaml' ':!tin/' | sort; }
if [ "${1:-}" = "--update" ]; then list > tin/polyform-files.txt; wc -l < tin/polyform-files.txt; exit 0; fi
new=$(comm -13 tin/polyform-files.txt <(list))
[ -z "$new" ] && { echo "Licence check OK: $(wc -l < tin/polyform-files.txt | tr -d ' ') known PolyForm files, no new ones."; exit 0; }
echo "New PolyForm-licensed files (review the licence impact, then run tin/check-licenses.sh --update):" >&2
echo "$new" >&2
exit 1
