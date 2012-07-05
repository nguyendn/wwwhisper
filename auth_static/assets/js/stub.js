/*!
 * wwwhisper - web access control.
 * Copyright (C) 2012 Jan Wrobel
 *
 * Licensed under the AGPL License version 3 or any later version:
 * https://www.gnu.org/licenses/agpl-3.0.html
 */
(function () {
  'use strict';

  /**
   * Communicates with the server. Makes sure each request carries
   * cross site request forgery protection cookie. Serializes requests
   * parameters to JSON.
   */
  function Stub() {
    var csrfToken = null, errorHandler = null, that = this;

    /**
     * Helper private function, in addition to all arguments accepted
     * by the public ajax() function, takes dictionary of headers to
     * be sent along with the request.
     */
    function ajaxCommon(method, resource, params, headersDict,
                        successCallback, errorHandlerArg) {
      var settings = {
        url: resource,
        type: method,
        headers: headersDict,
        success: successCallback,
        error: function(jqXHR) {
          if (typeof errorHandlerArg !== 'undefined') {
            errorHandlerArg(jqXHR.responseText, jqXHR.status);
          } else if (errorHandler !== null) {
            errorHandler(jqXHR.responseText, jqXHR.status);
          } else {
            // No error handler. Fatal error:
            $('html').html(jqXHR.responseText);
          }
        }
      };
      if (params !== null) {
        settings['data'] = JSON.stringify(params);
        settings['contentType'] = 'application/json; charset=utf-8';
      };
      $.ajax(settings);
    }

    /**
     * Private function that retrieves csrf protection token and
     * invokes a callback on success.
     */
    function getCsrfToken(nextCallback, errorHandlerArg) {
      ajaxCommon('POST', '/auth/api/csrftoken/', null, null,
                 function(result) {
                   csrfToken = result.csrfToken;
                   nextCallback();
                 }, errorHandlerArg);
    }

    /**
      * Invokes a given HTTP method (a string) on a given resource (a
      * string), passing to it parameters (an object that the function
      * serializes to json and that can be null). When successfully
      * done, invokes a successCallback.
      *
      * On failure, if an errorHandler is given as an argument or set
      * with setErrorHandler, invokes the handler and passes to it an
      * error message along with an HTTP error code. If the error
      * handler is not defined, errors are considered fatal - current
      * document message body is replaced with an error message.
      */
    this.ajax = function(method, resource, params, successCallback,
                         errorHandlerArg) {
      if (csrfToken === null) {
        // Each HTTP method call, except the one that returns a csrf
        // protection token needs to carry the token. Get the token
        // and reexecute the call.
        getCsrfToken(function() {
          that.ajax(method, resource, params, successCallback, errorHandlerArg);
        }, errorHandlerArg);
        return;
      }
      ajaxCommon(method, resource, params, {'X-CSRFToken' : csrfToken},
                 successCallback, errorHandlerArg);
    };

    /**
     * Convenience method that registers a permanent callback to be
     * invoked when HTTP method returns an error. Useseful when the
     * same callback is used for many ajax() calls. Callback passed
     * directly to the ajax call takes precedence over the one set
     * with the setter.
     */
    this.setErrorHandler = function(handler) {
      errorHandler = handler;
    };
  }

  if (typeof(window.wwwhisper) === 'undefined'){
    window.wwwhisper = {};
  }
  window.wwwhisper.Stub = Stub;
}());