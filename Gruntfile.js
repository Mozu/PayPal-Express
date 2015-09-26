module.exports = function (grunt) {
    'use strict';
    grunt.loadTasks('./tasks');
    require('time-grunt')(grunt);
    require('load-grunt-tasks')(grunt);
    grunt.initConfig({
        mozuconfig: grunt.file.readJSON('./mozu.config.json'),
        jshint: {
            'normal': ['./assets/src/**/*.js'],
            'continuous': {
                'options': { 'force': true },
                'src': '<%= jshint.normal %>'
            }
        },
        browserify: {
            'all': {
                'files': [{
                        'expand': true,
                        'cwd': 'assets/src/',
                        'src': ['**/*.manifest.js'],
                        'dest': 'assets/dist/',
                        'ext': '.all.js',
                        'extDot': 'last'
                    }],
                'options': {
                    'browserifyOptions': {
                        'standalone': 'index',
                        'commondir': false,
                        'builtins': [
                            'stream',
                            'util',
                            'path',
                            'url',
                            'string_decoder',
                            'events',
                            'net',
                            'punycode',
                            'querystring',
                            'dgram',
                            'dns',
                            'assert',
                            'tls',
                            'crypto'
                        ],
                        'insertGlobals': false,
                        'detectGlobals': false
                    }
                }
            }
        },
        manifest: { 'all': { 'files': '<%= browserify.all.files %>' } },
        mozusync: {
            'options': {
                'applicationKey': '<%= mozuconfig.workingApplicationKey %>',
                'context': '<%= mozuconfig %>',
                'watchAdapters': [
                    {
                        'src': 'mozusync.upload.src',
                        'action': 'upload',
                        'always': ['./assets/functions.json']
                    },
                    {
                        'src': 'mozusync.del.remove',
                        'action': 'delete'
                    }
                ]
            },
            'upload': {
                'options': {
                    'action': 'upload',
                    'noclobber': true
                },
                'src': ['./assets/**/*'],
                'filter': 'isFile'
            },
            'del': {
                'options': { 'action': 'delete' },
                'src': '<%= mozusync.upload.src %>',
                'filter': 'isFile',
                'remove': []
            },
            'wipe': {
                'options': { 'action': 'deleteAll' },
                'src': '<%= mozusync.upload.src %>'
            }
        },
        watch: {
            'options': { 'spawn': false },
            'src': {
                'files': '<%= jshint.normal %>',
                'tasks': [
                    'jshint:continuous',
                    'browserify:all',
                    'manifest'
                ]
            },
            'sync': {
                'files': ['assets/**/*'],
                'tasks': [
                    'mozusync:upload',
                    'mozusync:del'
                ]
            }
        },
        mochaTest: {
            'all': {
                'clearRequireCache': true,
                'src': ['assets/test/**/*.js']
            }
        }
    });
    grunt.registerTask('build', [
        'jshint:normal',
        'browserify:all',
        'manifest',
        'test'
    ]);
    grunt.registerTask('default', [
        'build',
        'mozusync:upload'
    ]);
    grunt.registerTask('reset', [
        'mozusync:wipe',
        'mozusync:upload'
    ]);
    grunt.registerTask('cont', ['watch']);
    grunt.registerTask('c', ['watch']);
    grunt.registerTask('w', ['watch']);
    grunt.registerTask('test', ['mochaTest']);
};