(function () {
  'use strict';
  var utils;
  var wwwhisper;

  utils = {
    each: function(iterable, callback) {
      $.each(iterable, function(_id, value) {
        callback(value);
      });
    },

    findOnly: function(array, filterCallback) {
      var result;
      result = $.grep(array, filterCallback);
      if (result.length === 0) {
        return null;
      }
      // TODO: assert array has only one element.
      return result[0];
    },

    inArray: function(value, array) {
      return ($.inArray(value, array) >= 0);
    },

    removeFromArray: function(value, array) {
      var idx = $.inArray(value, array);
      if (idx === -1) {
        return;
      }
      array.splice(idx, 1);
    },

    urn2uuid: function(urn) {
      return urn.replace('urn:uuid:', '');
    },

    extractLocationsPaths: function(locations) {
      return $.map(locations, function(item) {
        return item.path;
      });
    },

    allowedUsersIds: function(location) {
      return $.map(location.allowedUsers, function(user) {
        return user.id;
      });
    }
  };

  wwwhisper = {
    locations: [],
    users: [],

    canAccess: function(user, location) {
      return utils.inArray(
        user.id, utils.allowedUsersIds(location));
    },

    removeAllowedUser: function(user, location) {
      location.allowedUsers = $.grep(location.allowedUsers, function(u) {
        return u.id !== user.id;
      });
    },

    findUserWithEmail: function(email) {
      return utils.findOnly(wwwhisper.users, function(user) {
        return user.email === email;
      });
    },

    findLocationWithId: function(id) {
      return utils.findOnly(wwwhisper.locations, function(location) {
        return location.id === id;
      });
    },

    accessibleLocations: function(user) {
      return $.grep(wwwhisper.locations, function(location) {
        return wwwhisper.canAccess(user, location);
      });
    },

    getCsrfToken: function(nextCallback) {
      wwwhisper.stub.ajax('GET', '/auth/api/csrftoken/', null,
                          function(result) {
                            wwwhisper.stub.csrfToken = result.csrfToken;
                            nextCallback();
                          });
    },

    getLocations: function(nextCallback) {
      wwwhisper.stub.ajax('GET', 'api/locations/', null, function(result) {
        // TODO: parse json here.
        wwwhisper.locations = result.locations;
        nextCallback();
      });
    },

    getUsers: function(nextCallback) {
      wwwhisper.stub.ajax('GET', 'api/users/', null, function(result) {
        // TODO: parse json here.
        wwwhisper.users = result.users;
        nextCallback();
      });
    },

    buildCallbacksChain: function(callbacks) {
      if (callbacks.length === 1) {
        return callbacks[0];
      }
      return function() {
        callbacks[0](
          wwwhisper.buildCallbacksChain(callbacks.slice(1, callbacks.length))
        );
      }
    },

    addLocation: function(locationPathArg) {
      var locationPath = $.trim(locationPathArg);
      if (locationPath.length === 0 || utils.inArray(
        locationPath, utils.extractLocationsPaths(wwwhisper.locations))) {
        // TODO: Should existence check be done by client? Path is
        // encoded anyway on the server site, so this check is not
        // 100% accurate.
        return;
      }
      wwwhisper.stub.ajax('POST', 'api/locations/', {path: locationPath},
                          function(newLocation) {
                            // TODO: parse json.
                            wwwhisper.locations.push(newLocation);
                            wwwhisper.ui.refresh();
                          });
    },

    removeLocation: function(location) {
      wwwhisper.stub.ajax(
        'DELETE', location.self, null,
        function() {
          utils.removeFromArray(location, wwwhisper.locations);
          wwwhisper.ui.refresh();
        });
    },

    addUser: function(emailArg, nextCallback) {
      wwwhisper.stub.ajax('POST', 'api/users/', {email: emailArg},
                          function(user) {
                            wwwhisper.users.push(user);
                            nextCallback(user);
                          });
    },

    removeUser: function(user) {
      wwwhisper.stub.ajax(
        'DELETE', user.self, null,
        function() {
          utils.each(wwwhisper.locations, function(location) {
            if (wwwhisper.canAccess(user, location)) {
              wwwhisper.removeAllowedUser(user, location);
            }
          });
          utils.removeFromArray(user, wwwhisper.users);
          wwwhisper.ui.refresh();
        });
    },

    // TODO: allow->grant
    allowAccessByUser: function(email, location) {
      var cleanedEmail, user, location, grantPermissionCallback;
      cleanedEmail = $.trim(email);
      if (cleanedEmail.length === 0) {
        return;
      }
      user = wwwhisper.findUserWithEmail(cleanedEmail);
      if (user !== null && wwwhisper.canAccess(user, location)) {
        // User already can access location.
        return;
      }

      grantPermissionCallback = function(userArg) {
        wwwhisper.stub.ajax(
          'PUT',
          location.self + 'allowed-users/'
            + utils.urn2uuid(userArg.id) + '/',
          null,
          function() {
            location.allowedUsers.push(userArg);
            wwwhisper.ui.refresh();
          });
      };

      if (user !== null) {
        grantPermissionCallback(user);
      } else {
        wwwhisper.addUser(cleanedEmail, grantPermissionCallback);
      }
    },

    revokeAccessByUser: function(user, location) {
      wwwhisper.stub.ajax(
        'DELETE',
        location.self + 'allowed-users/' + utils.urn2uuid(user.id) + '/',
        null,
        function() {
          wwwhisper.removeAllowedUser(user, location);
          wwwhisper.ui.refresh();
        });
    },

    initialize: function() {
      wwwhisper.ui.initialize();
      wwwhisper.buildCallbacksChain([wwwhisper.getCsrfToken,
                                     wwwhisper.getLocations,
                                     wwwhisper.getUsers,
                                     wwwhisper.ui.refresh])();
    },
  };

  function UI() {
    var view = {
      locationPath : null,
      locationInfo : null,
      allowedUser : null,
      addLocation : null,
      user : null
    };

    function focusedElement() {
      return $(document.activeElement);
    };

    function locationPathId(location) {
      return 'location-' + utils.urn2uuid(location.id);
    };

    function locationInfoId(location) {
      return 'resource-info-' + utils.urn2uuid(location.id);
    };

    function addAllowedUserInputId(location) {
      return 'add-allowed-user-input-' + utils.urn2uuid(location.id);
    };

    function findSelectLocation() {
      var activeElement, urn;
      activeElement = $('#location-list').find('.active');
      if (activeElement.length === 0) {
        return null;
      }
      urn = activeElement.attr('location-urn');
      return utils.findOnly(wwwhisper.locations, function(location) {
        return location.id === urn;
      });
    };

    function showUsers() {
      var userView;
      utils.each(wwwhisper.users, function(user) {
        userView = view.user.clone(true);
        userView.find('.user-mail').text(user.email).end()
          .find('.remove-user').click(function() {
            wwwhisper.removeUser(user);
          }).end()
          .find('.highlight').hover(function() {
            highlightAccessibleLocations(user);
          }, highlighLocationsOff).end()
          .find('.notify').click(function() {
            showNotifyDialog(
              [user.email],
              utils.extractLocationsPaths(
                wwwhisper.accessibleLocations(user))
            );
          }).end()
          .appendTo('#user-list');
      });
    };

    function showLocations() {
      utils.each(wwwhisper.locations, function(location) {
        view.locationPath.clone(true)
          .attr('id', locationPathId(location))
          .attr('location-urn', location.id)
          .find('.url').attr(
            'href', '#' + locationInfoId(location)).end()
          .find('.path').text(location.path).end()
          .find('.remove-location').click(function(event) {
            // Do not show removed location info.
            event.preventDefault();
            wwwhisper.removeLocation(location);
          }).end()
          .find('.notify').click(function() {
            showNotifyDialog(
              location.allowedUsers, [location.path]);
          }).end()
          .appendTo('#location-list');
        createLocationInfo(location);
      });

      view.addLocation.clone(true)
        .find('#add-location-input')
      // TODO: fix or remove.
      // .typeahead({
      //   'source': utils.allLocationsPaths()
      // })
        .change(function() {
          wwwhisper.addLocation($(this).val());
        }).end()
        .appendTo('#location-list');
    };

    function showLocationInfo(location) {
      $('#' + locationPathId(location)).addClass('active');
      $('#' + locationInfoId(location)).addClass('active');
    };

    function createLocationInfo(location) {
      var locationInfo, allowedUserList;
      locationInfo = view.locationInfo.clone(true)
        .attr('id', locationInfoId(location))
        .attr('location-urn', location.id)
        .find('.add-allowed-user')
        .attr('id', addAllowedUserInputId(location))
        .change(function() {
          wwwhisper.allowAccessByUser($(this).val(), location);
        })
      // TODO: fix of remove.
      // .typeahead({
      //   'source': model.users
      // })
        .end();

      allowedUserList = locationInfo.find('.allowed-user-list');
      utils.each(location.allowedUsers, function(user) {
        view.allowedUser.clone(true)
          .find('.user-mail').text(user.email).end()
          .find('.remove-user').click(function() {
            wwwhisper.revokeAccessByUser(user, location);
          }).end()
          .appendTo(allowedUserList);
      });
      locationInfo.appendTo('#location-info-list');
    };

    function highlightAccessibleLocations(user) {
      utils.each(wwwhisper.locations, function(location) {
        var id = '#' + locationPathId(location);
        if (wwwhisper.canAccess(user, location)) {
          $(id + ' a').addClass('accessible');
        } else {
          $(id + ' a').addClass('not-accessible');
        }
      });
    };

    function highlighLocationsOff() {
      $('#location-list a').removeClass('accessible');
      $('#location-list a').removeClass('not-accessible');
    };

    function showNotifyDialog(to, locations) {
      var body, website, locationsString, delimiter;
      if (locations.length === 0) {
        body = 'I have shared nothing with you. Enjoy.';
      } else {
        website = 'a website';
        if (locations.length > 1) {
          website = 'websites';
        }
        locationsString = $.map(locations, function(locationPath) {
          delimiter = (locationPath[0] !== '/') ? '/' : '';
          return 'https://' + location.host + delimiter + locationPath;
        }).join('\n');

        body = 'I have shared ' + website + ' with you.\n'
          + 'Please visit:\n' + locationsString;
      }
      $('#notify-modal')
        .find('#notify-to').attr('value', to.join(', ')).end()
        .find('#notify-body').text(body).end()
        .modal('show');
    };


    this.refresh = function() {
      var focusedElementId, selectLocation;
      selectLocation = findSelectLocation();
      focusedElementId = focusedElement().attr('id');

      if (selectLocation === null && wwwhisper.locations.length > 0) {
        selectLocation = wwwhisper.locations[0];
      }

      $('#location-list').empty();
      $('#location-info-list').empty();
      $('#user-list').empty();

      showLocations();
      showUsers();

      if (selectLocation !== null) {
        showLocationInfo(selectLocation);
      }
      if (focusedElementId) {
        $('#' + focusedElementId).focus();
      }
    };

    this.initialize = function() {
      view.locationPath = $('#location-list-item').clone(true);
      view.locationInfo = $('#location-info-list-item').clone(true);
      view.allowedUser = $('#allowed-user-list-item').clone(true);
      view.locationInfo.find('#allowed-user-list-item').remove();
      view.addLocation = $('#add-location').clone(true);
      view.user = $('.user-list-item').clone(true);
      $('.locations-root').text(location.host);
    };
  };

  wwwhisper.stub = {
    csrfToken: null,

    ajax: function(method, resource, params, successCallback) {
      var jsonData = null;
      if (params !== null) {
        jsonData = JSON.stringify(params);
      }

      $.ajax({
        url: resource,
        type: method,
        data: jsonData,
        //dataType: method === 'GET' ?  'json' : 'text',
        dataType: 'json',
        headers: {'X-CSRFToken' : wwwhisper.stub.csrfToken},
        success: successCallback,
        error: function(jqXHR) {
          // TODO: nice messages for user input related failures.
          $('body').html(jqXHR.responseText);
        }
      });
    }
  };

  if (window.ExposeForTests) {
    wwwhisper.utils = utils;
    window.wwwhisper = wwwhisper;
  } else {
    wwwhisper.ui = new UI();
    wwwhisper.initialize();
  }
}());
