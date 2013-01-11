print "Using testing configuration."

SECRET_KEY = 'RVh*fxg-hH2vJaTxbmXOvYn@iasPr5yKSE=tLckE5!fzEKj@NU'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': '/tmp/wwwhisper_test_db',
    }
}

SITE_URL = 'http://localhost:8080'
WWWHISPER_ADMINS = ['alice@example.com']
WWWHISPER_STATIC = 'www_static'
