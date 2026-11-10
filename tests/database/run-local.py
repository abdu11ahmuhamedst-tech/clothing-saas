"""Create, validate, and stop a new private local cluster. Never use a system cluster."""
import hashlib
import json
import os
from pathlib import Path
import pwd
import subprocess
import sys
import tempfile

project = Path(__file__).resolve().parents[2]
migrations = sorted((project / 'supabase/migrations').glob('*.sql'))
before = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in migrations}
root = Path(tempfile.mkdtemp(prefix='clothing-saas-pg-'))
root.chmod(0o700)
(root / 'LOCAL_VALIDATION_ONLY').write_text('Disposable synthetic validation data only\n')
(root / 'socket').mkdir(mode=0o700)
user = pwd.getpwuid(os.getuid()).pw_name
if os.getuid() == 0:
    sys.exit('Must run unprivileged')
env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
env.update(PGHOST=str(root/'socket'), PGPORT='55439', PGDATABASE='clothing_validation', PGUSER=user,
           PGOPTIONS='-c statement_timeout=5000 -c lock_timeout=2000')
report = {'directory': str(root), 'os_user': user, 'migration_hashes_before': before, 'migrations': [], 'boundary_tests': [], 'stopped': False}
print('Disposable directory: '+str(root), flush=True)

def execute(command, **kwargs):
    result = subprocess.run(command, env=env, text=True, capture_output=True, timeout=60, **kwargs)
    if result.returncode:
        raise RuntimeError(f'{command[0]} failed: {result.stdout}\n{result.stderr}')
    return result.stdout

try:
    report['postgres_version'] = execute(['postgres','--version']).strip()
    execute(['initdb','-D',str(root/'data'),'--auth-local=peer','--auth-host=reject','--no-locale','--encoding=UTF8'])
    (root/'data/pg_ident.conf').write_text(''.join(f'validation {user} {role}\n' for role in [user,'test_anon','test_authenticated','test_service_role']))
    (root/'data/pg_hba.conf').write_text('local all all peer map=validation\nhost all all 0.0.0.0/0 reject\nhost all all ::/0 reject\n')
    with (root/'data/postgresql.conf').open('a') as config:
        config.write(f"\nlisten_addresses = ''\nunix_socket_directories = '{root}/socket'\nunix_socket_permissions = 0700\nport = 55439\nshared_buffers = '32MB'\nmax_connections = 10\nmax_parallel_workers = 0\n")
    execute(['pg_ctl','-D',str(root/'data'),'-l',str(root/'server.log'),'-w','start'])
    execute(['createdb','clothing_validation'])
    execute(['psql','-X','-v','ON_ERROR_STOP=1','-f',str(project/'tests/database/bootstrap.sql')])
    for index, migration in enumerate(migrations):
        log = execute(['psql','-X','-v','ON_ERROR_STOP=1','-f',str(migration)])
        (root/(migration.name+'.log')).write_text(log)
        report['migrations'].append({'name': migration.name, 'passed': True})
        if index == 0:
            for role in ['anon','authenticated']:
                for table in ['stores','domains','memberships','products','variants','inventory','orders','order_items']:
                    result = subprocess.run(['psql','-X','-qAt','-U','test_'+role,'-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'],
                        input=f'set role {role}; select * from public.{table};',env=env,text=True,capture_output=True,timeout=10)
                    passed = result.returncode != 0 and '42501' in result.stderr
                    report['boundary_tests'].append({'name': f'first migration closes {table} to {role}', 'passed': passed})
    result = subprocess.run([sys.executable,str(project/'tests/database/validate.py'),'--directory',str(root)],env=env,text=True,capture_output=True,timeout=120)
    (root/'test-output.log').write_text(result.stdout+result.stderr)
    print(result.stdout, end='', flush=True)
    if (root/'security-results.json').exists():
        report['security'] = json.loads((root/'security-results.json').read_text())
    if result.returncode:
        raise RuntimeError('Security harness returned failure: '+result.stderr)
except Exception as error:
    report['error'] = str(error)
    print(str(error), file=sys.stderr)
finally:
    if (root/'data/postmaster.pid').exists():
        result = subprocess.run(['pg_ctl','-D',str(root/'data'),'-m','fast','-w','stop'],env=env,text=True,capture_output=True,timeout=30)
        report['shutdown_output'] = result.stdout+result.stderr
        report['stopped'] = result.returncode == 0 and not (root/'data/postmaster.pid').exists()
    else:
        report['stopped'] = True
    report['migration_hashes_after'] = {p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in migrations}
    report['migrations_unchanged'] = before == report['migration_hashes_after']
    cases = report['boundary_tests'] + report.get('security',{}).get('tests',[])
    report['passed'] = sum(bool(t['passed']) for t in cases)
    report['failed'] = sum(not t['passed'] for t in cases)
    (root/'validation-report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:report[k] for k in ['directory','passed','failed','stopped','migrations_unchanged']}),flush=True)
sys.exit(bool(report.get('error')) or report['failed'] != 0 or not report['stopped'] or not report['migrations_unchanged'])
