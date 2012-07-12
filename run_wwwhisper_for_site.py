#!/bin/bash


# http://stackoverflow.com/questions/59895/can-a-bash-script-tell-what-directory-its-stored-in
SCRIPT_DIR="$(cd "$( dirname "$0" )" && pwd)"
# TODO: change this.
VIRTUALENV_DIR=${SCRIPT_DIR}/virtualenv
SITE_DIR=

err_quit() {
    echo 1>&2 ${1}
    exit 1
}

usage() {
    cat 1>&2 << EOF

Starts uWSGI managed wwwhisper instance for a given site.

   The script accepts a single argument - a path to a site-specific
   directory that was generated with 'add_protected_site.py'.
   Example usage:
      ${0} -d ./sites/https/example.com/
EOF
    exit 1
}

assert_dir_exists() {
    if [[ ! -d "${1}" ]]; then
        err_quit "Directory '${1}' does not exist."
    fi
}

while getopts “hd:” OPTION
do
    case ${OPTION} in
        h)
            usage
            ;;
        d)
            SITE_DIR=${OPTARG}
            ;;
    esac
done

if [[ -z ${SITE_DIR} ]]; then
    usage
    exit 1
fi

assert_dir_exists ${SITE_DIR}
# Transform site dir to be an absolute path.
SITE_DIR="$(cd "${SITE_DIR}" && pwd)"
# Sanity check.
assert_dir_exists ${SITE_DIR}

source ${VIRTUALENV_DIR}/bin/activate \
    || err_quit "Failed to activate virtualenv in ${VIRTUALENV_DIR}."

uwsgi --chdir="${SCRIPT_DIR}/django_wwwhisper"\
 --module="wwwhisper_service.wsgi:application"\
 --socket="${SITE_DIR}/uwsgi.sock"\
 --master\
 --vacuum\
 --processes=5\
 --chmod-socket=660\
 --plugins=python\
 --python-path="${SITE_DIR}/settings/"\
 --virtualenv="${VIRTUALENV_DIR}"\
    || err_quit "Failed to start uwsgi."