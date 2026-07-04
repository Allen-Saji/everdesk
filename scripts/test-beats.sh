#!/usr/bin/env bash
# P4 beat verification against local dev server + real Cognee tenant.
# Usage: scripts/test-beats.sh <publicKey>
set -u
PK="$1"
BASE="http://localhost:3000"
J="Content-Type: application/json"

echo "=== 1. wait for jane's durable memory pipeline ==="
until curl -s "$BASE/api/companies/zenith-test/train" | grep -q '"memory":"DATASET_PROCESSING_COMPLETED"'; do sleep 5; done
echo "memory pipeline complete"

echo "=== 2. returning customer (new session) ==="
curl -s -X POST "$BASE/api/v1/chat" -H "$J" -d "{\"key\":\"$PK\",\"visitorId\":\"visitor-jane-001\",\"email\":\"jane@test.io\",\"message\":\"Have we spoken before? What was my issue?\"}" | python3 -c "import json,sys; d=json.load(sys.stdin); print('grounded:', d['grounded']); print(d['answer'][:300])"

echo
echo "=== 3. customer graph route ==="
CUST=$(curl -s -X POST "$BASE/api/v1/chat" -H "$J" -d "{\"key\":\"$PK\",\"visitorId\":\"visitor-jane-001\",\"email\":\"jane@test.io\",\"message\":\"thanks\"}" | python3 -c "import json,sys; print(json.load(sys.stdin)['customerId'])")
echo "customerId=$CUST"
curl -s "$BASE/api/companies/zenith-test/customers/$CUST/graph" | python3 -c "import json,sys; d=json.load(sys.stdin); print('customer nodes:', d['customerNodes'], '/ total:', d['totalNodes'], '| edges:', len(d['edges']))"

echo
echo "=== 4. feedback on a real qa turn ==="
SESSION=$(curl -s "$BASE/api/events?slug=zenith-test&limit=50" >/dev/null; curl -s -X POST "$BASE/api/v1/chat" -H "$J" -d "{\"key\":\"$PK\",\"visitorId\":\"visitor-jane-001\",\"email\":\"jane@test.io\",\"message\":\"what does the pro plan cost?\"}" | python3 -c "import json,sys; print(json.load(sys.stdin)['sessionId'])")
echo "session=$SESSION"
sleep 3
QA=$(node -e "
const {readFileSync}=require('fs');
for (const f of ['.env.local','.env']) { try { for (const l of readFileSync(f,'utf8').split('\n')) { const m=l.match(/^([A-Z_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2]; } } catch{} }
fetch(process.env.COGNEE_BASE_URL+'/api/v1/sessions/$SESSION',{headers:{'X-Api-Key':process.env.COGNEE_API_KEY,'X-Tenant-Id':process.env.COGNEE_TENANT_ID}}).then(r=>r.json()).then(d=>console.log(d.qas?.[d.qas.length-1]?.qa_id ?? ''));
")
echo "qa_id=$QA"
if [ -n "$QA" ]; then
  curl -s -X POST "$BASE/api/companies/zenith-test/feedback" -H "$J" -d "{\"sessionId\":\"$SESSION\",\"qaId\":\"$QA\",\"score\":5}"
  echo
fi

echo
echo "=== 5. resolve -> KB learning ==="
curl -s -X POST "$BASE/api/companies/zenith-test/resolve" -H "$J" -d '{"problem":"Widget bluetooth pairing fails on Linux","solution":"Install acme-bt-driver 2.1 and re-pair; verified working on Ubuntu and Mint."}'
echo
until curl -s "$BASE/api/companies/zenith-test/train" | grep -q '"training":false'; do sleep 5; done
sleep 2
echo "resolution cognified; new customer asks same question:"
curl -s -X POST "$BASE/api/v1/chat" -H "$J" -d "{\"key\":\"$PK\",\"visitorId\":\"visitor-raj-002\",\"email\":\"raj@test.io\",\"message\":\"bluetooth pairing fails on my Linux machine, any fix?\"}" | python3 -c "import json,sys; d=json.load(sys.stdin); print('grounded:', d['grounded']); print(d['answer'][:300])"

echo
echo "=== 6. forget-me ==="
curl -s -X POST "$BASE/api/companies/zenith-test/customers/$CUST/forget" -X POST
echo
curl -s "$BASE/api/companies/zenith-test/customers/$CUST/graph" | python3 -c "import json,sys; d=json.load(sys.stdin); print('customer nodes after forget:', d['customerNodes'])"

echo
echo "=== 7. events feed tail ==="
curl -s "$BASE/api/events?slug=zenith-test&limit=12" | python3 -c "import json,sys; [print(e['type'].ljust(9), e['label']) for e in json.load(sys.stdin)['events']]"
