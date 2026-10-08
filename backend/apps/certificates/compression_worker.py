"""Fresh process resource boundary; never preexec_fn inside threaded Gunicorn."""
import os
import resource
import shutil
import sys


def main():
    resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024,) * 2)
    resource.setrlimit(resource.RLIMIT_CPU, (12, 12))
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    mode, source, target = sys.argv[1:]
    maximum = 16 * 1024 * 1024 if mode == 'json' else 64 * 1024 * 1024
    resource.setrlimit(resource.RLIMIT_FSIZE, (maximum, maximum))
    executable = shutil.which('qpdf')
    if not executable:
        sys.exit(127)
    if mode == 'json':
        args = ['--json', '--json-stream-data=none', source]
    elif mode == 'check':
        args = ['--check', source]
    elif mode == 'compress':
        args = ['--object-streams=generate', '--stream-data=compress', '--recompress-flate', '--compression-level=9', source, target]
    else:
        sys.exit(2)
    os.execv(executable, [executable, *args])


if __name__ == '__main__':
    main()
