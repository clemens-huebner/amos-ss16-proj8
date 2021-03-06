/*
 This file is part of MyConference.

 MyConference is free software: you can redistribute it and/or modify
 it under the terms of the GNU Affero General Public License version 3
 as published by the Free Software Foundation.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU Affero General Public License for more details.

 You should find a copy of the GNU Affero General Public License in the
 root directory along with this program.
 If not, see http://www.gnu.org/licenses/agpl-3.0.html.
 */
var services = angular.module('services', []);
services.factory('backendService', function ($rootScope, $q, $filter) {
    // credentials for actions when user is not logged in
    var defaultUsername = "default";
    var defaultPassword = "123456";
    var REMEMBER_LOGIN_KEY = "baasbox-remember-login";
    var backend = {};
    backend.currentUser = '';
    backend.loginStatus = false;
    /*
     Function for establishing connection to the backend
     After getting a connection logs in as a default user
     "default" means "not registered" user
     returns a promise
     */
    backend.connect = function () {
      BaasBox.setEndPoint("http://faui2o2a.cs.fau.de:30485");
      BaasBox.appcode = "1234567890";
      var deferred = $q.defer()
      backend.currentUser = JSON.parse(window.localStorage.getItem(REMEMBER_LOGIN_KEY));
      if (backend.currentUser) {
        if (backend.currentUser.username == defaultUsername) {
          backend.changeLoginStatus(false);
        } else {
          BaasBox.setCurrentUser(backend.currentUser);
          backend.changeLoginStatus(true);
        }
        deferred.resolve(backend.currentUser);
      } else {
        backend.changeLoginStatus(false);
        backend.login(defaultUsername, defaultPassword).then(
          function (res) {
            backend.currentUser = res;
            deferred.resolve(res);
          }, function (err) {
            deferred.reject(err);
          }
        );
      }
      return deferred.promise;
    };
    /*
     Function for getting list of events from backend
     Loads a collection where events are stored
     returns a promise
     */
    backend.getEvents = function () {
      return BaasBox.loadCollection("events")
        .done(function (res) {
          console.log("res ", res);
        })
        .fail(function (error) {
          console.log("error ", error);
        })
    };
    /*
     Function for fetching a current logged user
     returns a promise
     */
    backend.fetchCurrentUser = function () {
      return BaasBox.fetchCurrentUser();
    };
    /*
     Function for creating new user account
     First signs up using username and password credentials,
     then logs in as a new user and updates "visibleByTheUser" field adding email information
     and "visibleByRegisteredUsers" field saving name and given name
     */
    backend.createAccount = function (user) {
      return BaasBox.signup(user.email, user.pass)
        .done(function (res) {
          console.log("signup ", res);
          backend.login(user.email, user.pass).then(
            function (res) {
              backend.updateUserProfile({
                "visibleByTheUser": {
                  "email": user.email,
                  "settings": {"pushNotification": "yes"}
                }
              });
              backend.updateUserProfile({"visibleByRegisteredUsers": {"name": user.name, "gName": user.gName}});
              backend.applySettingsForCurrentUser();
            }
          );
        })
        .fail(function (error) {
          console.log("Signup error ", error);
        })
    };
    /*
     Function for logging in using login credentials
     returns a promise
     */
    backend.login = function (username, pass) {
      return BaasBox.login(username, pass)
        .done(function (user) {
          if (username != defaultUsername) {
            backend.changeLoginStatus(true);
            backend.currentUser = user;
          }
          console.log("Logged in ", username);
        })
        .fail(function (err) {
          console.log(" Login error ", err);
        });
    };
    backend.rememberLogin = function () {
      window.localStorage.setItem(REMEMBER_LOGIN_KEY, JSON.stringify(BaasBox.getCurrentUser()));
      console.log(window.localStorage.getItem(REMEMBER_LOGIN_KEY))
    }
    /*
     Function for logout
     returns a promise
     */
    backend.logout = function () {
      window.localStorage.removeItem(REMEMBER_LOGIN_KEY);
      backend.disablePushNotificationsForCurrentUser();
      return BaasBox.logout()
        .done(function (res) {
          backend.currentUser = '';
          backend.changeLoginStatus(false);
          console.log(res);
        })
        .fail(function (error) {
          console.log("error ", error);
        })
    };
    /*
     Function for changing the login status.
     Triggers event for menu refresh.
     */
    backend.changeLoginStatus = function (newStatus) {
      backend.loginStatus = newStatus;
      $rootScope.$broadcast('user:loginState', backend.loginStatus); //trigger menu refresh
    };
  /*
   Function for assirung that a user is logged in to the backend, as before making requests it is necessary to be logged in
   Checks if there is already a user logged in, if no then logs in as "default" user
   "default" user is not registered user
   returns promise
   */
    backend.assureConnection = function () {
      var dfd = $q.defer()
      if (!backend.loginStatus) {
        return backend.login(defaultUsername, defaultPassword)
      } else {
        dfd.resolve();
        return dfd.promise;
      }
    }
    /*
     Function for Reset
     returns a promise
     */
    backend.resetPassword = function (user) {
      BaasBox.resetPasswordForUser(user);
    };
    /*
     Function for updating user account
     requires 2 parameters: field to update and object with data that should be updated. See Baasbox API documentation
     returns a promise
     */
    backend.updateUserProfile = function (params) {
      return BaasBox.updateUserProfile(params)
        .done(function (res) {
          console.log("Updated ", res['data']);
        })
        .fail(function (error) {
          console.log("Update error ", error);
        })
    };
    /*
     Function for deleting an account.
     Gets the user as parameter.
     Calls the BaasBox function for deleting a user.
     Returns a promise.
     */
    backend.deleteAccount = function (user) {
      return BaasBox.deleteAccount(user)
        .done(function (res) {
          console.log(res);
        })
        .fail(function (err) {
          console.log("Delete error ", err);
        });
    };
    /*
     Function for creating a new event
     First saves a new document in "events" collection
     Then grants read permission to registered and not registered users
     */
    backend.createEvent = function (ev) {
      ev.participants = [];
      ev.questions = [];
      return BaasBox.save(ev, "events")
        .done(function (res) {
          console.log("res ", res);
          BaasBox.grantUserAccessToObject("events", res.id, BaasBox.READ_PERMISSION, "default");
          BaasBox.grantRoleAccessToObject("events", res.id, BaasBox.READ_PERMISSION, BaasBox.REGISTERED_ROLE);
          BaasBox.grantRoleAccessToObject("events", res.id, BaasBox.UPDATE_PERMISSION, BaasBox.REGISTERED_ROLE);
          BaasBox.loadAllCollection("organizer").done(function (orgcol) {
            for (i = 0; i < orgcol.length; i++) {
              BaasBox.grantUserAccessToObject("events", res.id, BaasBox.ALL_PERMISSION, orgcol[i].email);
            }
          })
        })
        .fail(function (error) {
          console.log("error ", error);
        })
    };
    /*
     Function for creating a new organizer
     First saves a new document in "organizer" collection
     Then grants read permission to registered and not registered users
     */
    backend.createOrganizer = function (user) {
      return BaasBox.save(user, "organizer")
        .done(function (res) {
          console.log("res ", res);
          BaasBox.grantUserAccessToObject("organizer", res.id, BaasBox.READ_PERMISSION, "default");
          BaasBox.grantRoleAccessToObject("organizer", res.id, BaasBox.READ_PERMISSION, BaasBox.REGISTERED_ROLE)
          BaasBox.loadAllCollection("organizer").done(function (orgcol) {
            for (i = 0; i < orgcol.length; i++) {
              BaasBox.grantUserAccessToObject("organizer", res.id, BaasBox.ALL_PERMISSION, orgcol[i].email);
            }
          })
        })
        .fail(function (error) {
          console.log("error ", error);
        })
    };
    /*
     Function for deleting an event
     */
    backend.deleteOrganizer = function (organizer) {
      //return
      BaasBox.deleteObject(organizer, "organizer")
        .done(function (res) {
          console.log(res);
        })
        .fail(function (err) {
          console.log("Delete error ", err);
        });
    };
    /*
     Function for deleting an event
     */
    backend.deleteEvent = function (eventId) {
      //return
      BaasBox.deleteObject(eventId, "events")
        .done(function (res) {
          console.log(res);
        })
        .fail(function (err) {
          console.log("Delete error ", err);
        });
    };
    /*
     Function for adding an agenda talk to an event
     */
    backend.addingAgenda = function (ag, evId) {
      return BaasBox.save(ag, "agenda")
        .done(function (res) {
          console.log("res ", res);
          BaasBox.updateEventAgenda(res, evId);
          BaasBox.grantUserAccessToObject("agenda", res.id, BaasBox.READ_PERMISSION, "default");
          BaasBox.grantRoleAccessToObject("agenda", res.id, BaasBox.READ_PERMISSION, BaasBox.REGISTERED_ROLE);
          BaasBox.loadAllCollection("organizer").done(function (orgcol) {
            for (i = 0; i < orgcol.length; i++) {
              BaasBox.grantUserAccessToObject("agenda", res.id, BaasBox.ALL_PERMISSION, orgcol[i].email);
            }
          })
        })
        .fail(function (error) {
          console.log("error ", error);
        })
    };
    /*
     Function for deleting a talk / agenda
     */
    backend.deleteAgenda = function (agendaId) {
      //return
      BaasBox.deleteObject(agendaId, "agenda")
        .done(function (res) {
          console.log(res);
        })
        .fail(function (err) {
          console.log("Delete error ", err);
        });
    };
    /*
     Function for getting an event by id
     returns a promise
     */
    backend.getEventById = function (id) {
      return BaasBox.loadObject("events", id)
    };
    /*
     Function for adding a question to an event
     */
    backend.addingQuestion = function (que, eventId) {
      return backend.getEventById(eventId).then(function (res) {
        event = res['data'];
        question = {};
        question = que;
        if (event.questions.length == 0) {
          questionId = 0;
        }
        else {
          questionId = event.questions[event.questions.length - 1].id + 1;
        }
        question.id = questionId;
        question.yes = 0;
        question.no = 0;
        question.dontKnow = 0;
        question.current = false;
        question.voted = [];
        event.questions.push(question);
        return BaasBox.updateField(eventId, "events", "questions", event.questions);
      })
    };
    /*
     Function for updating an event
     Can get one or three arguments
     If function is called only with one argument (event object) the whole event is updated
     If there are 3 arguments only one defined field of the event is updated with the given value
     Returns a promise.
     */
    backend.updateEvent = function (event, fieldToUpdate, value) {
      if (typeof fieldToUpdate === "undefined" || typeof value === "undefined") {
        return BaasBox.save(event, "events")
          .done(function (res) {
            console.log("res ", res);
            BaasBox.grantUserAccessToObject("events", res.id, BaasBox.READ_PERMISSION, "default");
            BaasBox.grantRoleAccessToObject("events", res.id, BaasBox.READ_PERMISSION, BaasBox.REGISTERED_ROLE);
            BaasBox.grantRoleAccessToObject("events", res.id, BaasBox.UPDATE_PERMISSION, BaasBox.REGISTERED_ROLE);
            BaasBox.loadAllCollection("organizer").done(function (orgcol) {
              for (i = 0; i < orgcol.length; i++) {
                BaasBox.grantUserAccessToObject("events", res.id, BaasBox.ALL_PERMISSION, orgcol[i].email);
              }
            })
          })
          .fail(function (error) {
            console.log("error ", error);
          })
      } else {
        return BaasBox.updateField(event, "events", fieldToUpdate, value)
          .done(function (res) {
            console.log("Event updated ", res);
          })
          .fail(function (error) {
            console.log("Event update error ", error);
          })
      }
    };
    /*
     Function for updating an agenda
     */
    backend.updateAgenda = function (agendaId, fieldToUpdate, value) {
      BaasBox.updateField(agendaId, "agenda", fieldToUpdate, value)
        .done(function (res) {
          console.log("Agenda updated ", res);
          BaasBox.grantUserAccessToObject("agenda", res.id, BaasBox.READ_PERMISSION, "default");
          BaasBox.grantRoleAccessToObject("agenda", res.id, BaasBox.READ_PERMISSION, BaasBox.REGISTERED_ROLE);
          BaasBox.loadAllCollection("organizer").done(function (orgcol) {
            for (i = 0; i < orgcol.length; i++) {
              BaasBox.grantUserAccessToObject("agenda", res.id, BaasBox.ALL_PERMISSION, orgcol[i].email);
            }
          })
        })
        .fail(function (error) {
          console.log("Agenda update error ", error);
        })
    };
    /*
     Function for uploading a file to the backend
     Gets a form with input file and ID of the event that it belongs to
     First uploads a file, then grants access permission to all users,
     after adds id of new uploaded file to the event that it belongs to
     Returns a promise
     */
    backend.uploadFile = function (uploadForm, eventId) {
      return BaasBox.uploadFile(uploadForm)
        .done(function (res) {
          console.log("res ", res);
          res = jQuery.parseJSON(res);
          BaasBox.grantUserAccessToFile(res['data'].id, BaasBox.READ_PERMISSION, "default");
          BaasBox.grantRoleAccessToFile(res['data'].id, BaasBox.READ_PERMISSION, BaasBox.REGISTERED_ROLE);
          BaasBox.loadAllCollection("organizer").done(function (orgcol) {
            for (i = 0; i < orgcol.length; i++) {
              BaasBox.grantUserAccessToFile(res['data'].id, BaasBox.ALL_PERMISSION, orgcol[i].email);
            }
          })
          backend.updateEvent(eventId, "fileId", res['data'].id)
        })
        .fail(function (error) {
          console.log("UPLOAD error ", error);
        })
    };
    /*
     Function for uploading a file to the backend
     Gets a form with input file and ID of the agenda that it belongs to
     First uploads a file, then grants access permission to all users,
     after adds id of new uploaded file to the agenda that it belongs to
     Returns a promise
     */
    backend.uploadFileAgenda = function (uploadForm, agendaId) {
      return BaasBox.uploadFile(uploadForm)
        .done(function (res) {
          console.log("res ", res);
          res = jQuery.parseJSON(res);
          BaasBox.grantUserAccessToFile(res['data'].id, BaasBox.READ_PERMISSION, "default");
          BaasBox.grantRoleAccessToFile(res['data'].id, BaasBox.READ_PERMISSION, BaasBox.REGISTERED_ROLE);
          BaasBox.loadAllCollection("organizer").done(function (orgcol) {
            for (i = 0; i < orgcol.length; i++) {
              BaasBox.grantUserAccessToFile(res['data'].id, BaasBox.ALL_PERMISSION, orgcol[i].email);
            }
          })
          backend.updateAgenda(agendaId, "fileId", res['data'].id)
        })
        .fail(function (error) {
          console.log("UPLOAD error ", error);
        })
    };
    /*
     Function for getting a download url for the file
     returns a string with url
     */
    backend.getFileUrl = function (fileId) {
      return BaasBox.getFileUrl(fileId)
    };
    /*
     Function for getting details about file
     returns a promise
     */
    backend.getFileDetails = function (fileId) {
      return BaasBox.fetchFileDetails(fileId)
    };
    /*
     Function for deleting a file
     */
    backend.deleteFile = function (fileId) {
      BaasBox.deleteFile(fileId)
        .done(function (res) {
          console.log("res ", res);
        })
        .fail(function (error) {
          console.log("error ", error);
        })
    };
    /*
     Function for adding a user to an event.
     Checks if user is already participant for avoiding double entries.
     Returns a promise.
     */
    backend.addUserToEvent = function (user, eventId) {
      var deferred = $q.defer();
      backend.getEventById(eventId).then(function (res) {
        event = res['data'];
        searchResult = $filter('filter')(event.participants, {"name": user.username});
        if (searchResult.length == 0) {
          // user never registered, insert into list
          participant = {};
          participant.name = user.username;
          participant.status = "joined";
          participant.updated = "false";
          event.participants.push(participant);
        } else {
          //user already in participants list, so just change status
          searchResult[0].status = "joined";
          searchResult[0].updated = "false";
        }
        BaasBox.updateField(eventId, "events", "participants", event.participants).then(
          function (res) {
            deferred.resolve(res);
          }, function (err) {
            deferred.reject(err)
          }
        )
      }, function (err) {
        deferred.reject(err)
      });
      return deferred.promise;
    };
    /*
     Function for adding the current user to an event.
     Calls addUserToEvent().
     Returns a promise.
     */
    backend.addCurrentUserToEvent = function (eventId) {
      return backend.addUserToEvent(BaasBox.getCurrentUser(), eventId)
    };
    /*
     Function for getting an agenda by eventID
     returns a collection
     */
    backend.loadAgendaWithParams = function (evId) {
      return BaasBox.loadAgendaWithParams("agenda", evId, {where: "eventID=?"});
    };
    /*
     Function for adding rating to an talk.
     Calls the abstract function addFeedbackToItem.
     Returns a promise.
     */
    backend.addFeedbackToTalk = function (talkId, rating, comment) {
      feedbackEntry = {rating: rating, comment: comment};
      return addFeedbackToItem(talkId, "agenda", feedbackEntry);
    };
    /*
     Function for changing the status of the user in the participant list of the event set (status = attended).
     Checks if user is already participant for avoiding double entries.
     Returns a promise.
     */
    backend.userStatusAttend = function (user, eventId) {
      var deferred = $q.defer();
      backend.getEventById(eventId).then(function (res) {
        event = res['data'];
        searchResult = $filter('filter')(event.participants, {"name": user.username});
        if (searchResult.length == 0) {
          // user never registered, insert into list
          participant = {};
          participant.name = user.username;
          participant.status = "attended";
          event.participants.push(participant);
        } else {
          //user already in participants list, so just change status
          searchResult[0].status = "attended";
        }
        BaasBox.updateField(eventId, "events", "participants", event.participants).then(
          function (res) {
            deferred.resolve(res);
          }, function (err) {
            deferred.reject(err)
          }
        )
      }, function (err) {
        deferred.reject(err)
      });
      return deferred.promise;
    };
    /*
     Function for changing the status of the current user in the participants list of the event.
     +   Calls userStatusAttend().
     +   Returns a promise.
     */
    backend.changeUserStatus = function (eventId) {
      return backend.userStatusAttend(BaasBox.getCurrentUser(), eventId)
    };
    /*
     Function for adding rating to an event.
     Excepts rating array of arbitrary length of the form:
     [
     { title: "CategoryName", rating: "ratingValue", comment: "comment" },
     { title: "CategoryName", rating: "ratingValue", comment: "comment" },
     (...)
     ]
     Calls the abstract function addFeedbackToItem.
     Returns a promise.
     */
    backend.addFeedbackToEvent = function (eventId, ratingArray) {
      return addFeedbackToItem(eventId, "events", ratingArray);
    };
    /*
     Abstract function for adding feedback to an item.
     Returns a promise.
     */
    addFeedbackToItem = function (itemId, collection, feedBackEntry) {
      var deferred = $q.defer();
      BaasBox.loadObject(collection, itemId).then(
        function (res) {
          item = res['data'];
          if (item.hasOwnProperty("feedback")) {
            item.feedback.push(feedBackEntry);
          } else {
            item.feedback = [feedBackEntry];
          }
          BaasBox.updateField(itemId, collection, "feedback", item.feedback).then(
            function (res) {
              deferred.resolve(res);
            }, function (err) {
              deferred.reject(err)
            }
          )
        }, function (err) {
          deferred.reject(err)
        });
      return deferred.promise;
    };
    /*
     Function for adding a user in the list of feedbackingUsers to avoid double feedback.
     Expects to be called only when it's cleared that the user is not yet in the list.
     Gets the id of the feedbacked event and the user object
     Returns a promise.
     */
    backend.addUserAsFeedbackerToEvent = function (eventId, user) {
      var deferred = $q.defer();
      backend.getEventById(eventId).then(
        function (res) {
          event = res.data;
          if (event.hasOwnProperty("feedbackingUsers")) {
            event.feedbackingUsers.push(user.username);
          } else {
            event.feedbackingUsers = [user.username];
          }
          backend.updateEvent(eventId, "feedbackingUsers", event.feedbackingUsers).then(
            function (res) {
              deferred.resolve(res);
            }, function (err) {
              deferred.reject(err);
            }
          )
        }, function (err) {
          deferred.reject(err)
        }
      )
      return deferred.promise;
    };
    /*
     Function for adding the current user in the list of feedbackingUsers to avoid double feedback.
     Expects to be called only when it's cleared that the user is not yet in the list.
     Gets the id of the feedbacked event and calls addUserAsFeedbackerToEvent
     Returns a promise.
     */
    backend.addCurrentUserAsFeedbackerToEvent = function (eventId) {
      return backend.addUserAsFeedbackerToEvent(eventId, BaasBox.getCurrentUser());
    };
    /*
     Function for checking if a user has already given feedback
     Gets the id of the feedbacked event and the user object
     Returns a promise resolving to the boolean value
     */
    backend.hasUserAlreadyGivenFeedback = function (eventId, user) {
      var deferred = $q.defer();
      backend.getEventById(eventId).then(
        function (res) {
          event = res.data;
          if (event.hasOwnProperty("feedbackingUsers")) {
            deferred.resolve(event.feedbackingUsers.indexOf(user.username) != -1);
          } else {
            deferred.resolve(false);
          }
        }, function (err) {
          deferred.reject(err);
        }
      )
      return deferred.promise;
    };
    /*
     Function for checking if the current user has already given feedback
     Gets the id of the feedbacked event the user object
     Returns a promise resolving to the boolean value
     */
    backend.hasCurrentUserAlreadyGivenFeedback = function (eventId) {
      return backend.hasUserAlreadyGivenFeedback(eventId, BaasBox.getCurrentUser());
    }
    /*
     Fucntion for removing a user from an event.
     Returns a promise.
     */
    backend.removeUserFromEvent = function (user, eventId) {
      var deferred = $q.defer();
      backend.getEventById(eventId).then(function (res) {
        event = res['data'];
        searchResult = $filter('filter')(event.participants, {"name": user.username});
        searchResult[0].status = "left";
        BaasBox.updateField(eventId, "events", "participants", event.participants).then(
          function (res) {
            deferred.resolve(res);
          }, function (err) {
            deferred.reject(err)
          }
        )
      }, function (err) {
        deferred.reject(err)
      });
      return deferred.promise;
    };
    /*
     Function for removing the current user from an event.
     Returns a promise.
     */
    backend.removeCurrentUserFromEvent = function (eventId) {
      return backend.removeUserFromEvent(BaasBox.getCurrentUser(), eventId)
    };
    /*
     Function for checking if a user is participant of an event.
     Returns a promise.
     */
    backend.isUserRegisteredForEvent = function (user, eventId) {
      return hasUserRightStatusInEvent(user, eventId, "joined");
    };
    /*
     Function for checking if the current user is user is participant of an event.
     Returns a promise.
     */
    backend.isCurrentUserRegisteredForEvent = function (eventId) {
      return backend.isUserRegisteredForEvent(BaasBox.getCurrentUser(), eventId)
    };
    /*
     Function for checking if a user is stored as attended at the event.
     Returns a promise.
     */
    backend.isUserAttendedForEvent = function (user, eventId) {
      return hasUserRightStatusInEvent(user, eventId, "attended");
    };
    /*
     Function for checking if current user is stored as attended at the event.
     Returns a promise
     */
    backend.isCurrentUserAttendedForEvent = function (eventId) {
      return backend.isUserAttendedForEvent(BaasBox.getCurrentUser(), eventId)
    };
    /*
     Abstract function for checking if an user has a given status as participant of an event.
     Returns a promise.
     */
    hasUserRightStatusInEvent = function (user, eventId, expectedStatus) {
      var deferred = $q.defer();
      backend.getEventById(eventId).then(function (res) {
        event = res['data'];
        searchResult = $filter('filter')(event.participants, {"name": user.username});
        console.log(searchResult);
        if (searchResult.length == 0) {
          //user not in participants list, so he's not registred
          deferred.resolve(false);
        } else {
          //user is in participants list, but is he still registred?
          deferred.resolve(searchResult[0].status == expectedStatus)
        }
      }), function (err) {
        deferred.reject(err)
      };
      return deferred.promise
    };
    /*
     Funtion for getting list of all users
     */
    backend.getUsers = function () {
      return BaasBox.fetchUsers()
        .done(function (res) {
          console.log("res ", res['data']);
        })
        .fail(function (error) {
          console.log("error ", error);
        })
    }
    /*
     Function for getting a user by his username
     returns a promise
     */
    backend.getUser = function (user) {
      return BaasBox.fetchUserProfile(user)
        .done(function (res) {
          console.log("res ", res['data']);
        })
        .fail(function (error) {
          console.log("error ", error);
        })
    };
    /*
     Function for getting a user by his email
     returns a promise
     */
    backend.getUserEmail = function (user) {
      return BaasBox.getUsers(user)
        .done(function (res) {
          console.log(res);
        })
        .fail(function (err) {
          console.log("get user error ", err);
        });
    }
    /*
     Function for getting a list of organizers
     returns a promise
     */
    backend.getOrganisers = function () {
      return BaasBox.loadCollection("organizer")
        .done(function (res) {
          console.log("res ", res);
        })
        .fail(function (error) {
          console.log("error ", error);
        })
    };
    /*
     Function for updating the participants who are joined the Event.
     updating the attribute "updated" = "false"
     Returns a promise.
     */
    backend.updatedIsFalse = function (user, eventId) {
      var deferred = $q.defer();
      backend.getEventById(eventId).then(function (res) {
        event = res['data'];
        searchResult = $filter('filter')(event.participants, {"name": user.username});
        if (searchResult.length == 0) {
          // user never registered, insert into list
          console.log('something is wrong')
        } else {
          //user already in participants list, so just change status
          searchResult[0].updated = "false";
        }
        BaasBox.updateField(eventId, "events", "participants", event.participants).then(
          function (res) {
            deferred.resolve(res);
          }, function (err) {
            deferred.reject(err)
          }
        )
      }, function (err) {
        deferred.reject(err)
      });
      return deferred.promise;
    };
    /*
     Function for updating  the current user attribute "updated".
     Calls updatedIsFalse().
     Returns a promise.
     */
    backend.SetStatusFalse = function (eventId) {
      return backend.updatedIsFalse(BaasBox.getCurrentUser(), eventId)
    };
    backend.updatedIsTrue = function (user, eventId) {
      var deferred = $q.defer();
      backend.getEventById(eventId).then(function (res) {
        event = res['data'];
        searchResult = $filter('filter')(event.participants, {});
        var l = searchResult.length;
        if (searchResult.length == 0) {
          // user never registered, insert into list
          console.log('No Participants in this Event')
        } else {
          //user already in participants list, so just change status
          for (var i = 0; i < l; i++) {
            searchResult[i].updated = "true";
          }
        }
        BaasBox.updateField(eventId, "events", "participants", event.participants).then(
          function (res) {
            deferred.resolve(res);
          }, function (err) {
            deferred.reject(err)
          }
        )
      }, function (err) {
        deferred.reject(err)
      });
      return deferred.promise;
    };
    /*
     Function for updating  the current user attribute "updated".
     Calls updatedIsTrue().
     Returns a promise.
     */
    backend.SetStatusTrue = function (eventId) {
      return backend.updatedIsTrue(BaasBox.getCurrentUser(), eventId)
    };
    /*
     Function for getting a speaker talk by agendId
     returns a promise
     */
    backend.getAgendaById = function (id) {
      return BaasBox.loadObject("agenda", id)
    };
    /*
     Function for sending a push notification with a text to a list of users.
     "users" has to be an array of usernames.
     Returns a promise.
     */
    backend.sendPushNotificationToUsers = function (message, users) {
      params = {
        "users": users,
        "message": message
      };
      console.log(users, message)
      return BaasBox.sendPushNotification(params);
    }
    /*
     Function for enabling push notifications for the current user.
     Returns a promise.
     */
    backend.enablePushNotificationsForCurrentUser = function () {
      operatingSystem = "android";
      return BaasBox.enableNotifications(operatingSystem, localStorage.getItem('registrationId'));
    };
    /*
     Function for disabling push notifications for the current user.
     Returns a promise.
     */
    backend.disablePushNotificationsForCurrentUser = function () {
      return BaasBox.disableNotifications(localStorage.getItem('registrationId'));
    };
    /*
     Function for applying the given settings to the user
     */
    backend.applySettings = function (settings) {
      if (settings !== undefined) {
        console.log(settings)
        if (settings.pushNotificationEnabled) {
          backend.enablePushNotificationsForCurrentUser();
        } else {
          backend.disablePushNotificationsForCurrentUser();
        }
      }
    }
    /*
     Function for applying the settings for the current user
     */
    backend.applySettingsForCurrentUser = function () {
      userInfo = backend.currentUser.visibleByTheUser;
      backend.applySettings(userInfo.settings);
    };
    /*
     Function for loading list of organizer with paramter, which is email / username of current user
     */
    backend.checkOrganizerExistence = function (userEmail) {
      return BaasBox.checkOrganizerWithParams(userEmail, {where: "email=?"});
    }
    /*
     Function for loading list of organizer with paramter, which is email / username of current user
     */
    backend.checkOrganizerWithParams = function () {
      return BaasBox.checkOrganizerWithParams(backend.currentUser.username, {where: "email=?"});
    }
    /*
     Function for checking whether the current user is an organizer
     */
    backend.isCurrentUserOrganizer = function (organizerListArray) {
      if (backend.currentUser.roles.indexOf('administrator') != -1 && backend.currentUser.username != defaultUsername) {
        backend.changeOrganizerStatus(true);
        return true;
      }
      if (organizerListArray > 0) {
        backend.changeOrganizerStatus(true);
        return true;
      }
      if (organizerListArray == 0) {
        backend.changeOrganizerStatus(false);
        return false;
      }
    }
    /*
     Function for changing the organizer status.
     Triggers event for menu refresh.
     */
    backend.changeOrganizerStatus = function (newStatus) {
      backend.organizerStatus = newStatus;
      $rootScope.$broadcast('user:organizerState', backend.organizerStatus); //trigger menu refresh
    };
    /*
     Function for getting the support contact.
     Support contact is the first (and normally only) entry in he support collection.
     Returns a promise.
     */
    backend.getSupportContact = function () {
      var deferred = $q.defer();
      BaasBox.loadCollection("support").then(
        function (res) {
          if (res.length > 0) {
            deferred.resolve(res[0]);
          } else {
            deferred.reject("No support mail adress defined.");
          }
        }, function (err) {
          deferred.reject(err);
        }
      );
      return deferred.promise;
    }
    /*
     Set the support contact.
     First gets the support contact, then updates the mail adress.
     If no contact is defined, a new one is created.
     Finally, it grants access rights for all registered users to it.
     Returns a promise.
     */
    backend.setSupportContact = function (mailadress) {
      var deferred = $q.defer();
      backend.getSupportContact().then(
        function (contact) {
          BaasBox.updateField(contact.id, "support", "mailadress", mailadress).then(
            function (res) {
              BaasBox.grantUserAccessToObject("support", contact.id, BaasBox.READ_PERMISSION, "default");
              BaasBox.grantRoleAccessToObject("support", contact.id, BaasBox.READ_PERMISSION, BaasBox.REGISTERED_ROLE);
              BaasBox.loadAllCollection("organizer").done(function (orgcol) {
                for (i = 0; i < orgcol.length; i++) {
                  BaasBox.grantUserAccessToObject("support", contact.id, BaasBox.ALL_PERMISSION, orgcol[i].email);
                }
              })
              deferred.resolve();
            }, function (err) {
              deferred.reject(err);
            }
          )
        }, function (err) {
          if (err == "No support mail address defined.") {
            BaasBox.save({"mailadress": mailadress}, "support").then(
              function (contact) {
                BaasBox.grantUserAccessToObject("support", contact.id, BaasBox.READ_PERMISSION, "default");
                BaasBox.grantRoleAccessToObject("support", contact.id, BaasBox.READ_PERMISSION, BaasBox.REGISTERED_ROLE);
                BaasBox.loadAllCollection("organizer").done(function (orgcol) {
                  for (i = 0; i < orgcol.length; i++) {
                    BaasBox.grantUserAccessToObject("support", contact.id, BaasBox.ALL_PERMISSION, orgcol[i].email);
                  }
                })
                deferred.resolve();
              }, function (err) {
                deferred.reject(err);
              }
            );
          } else {
            deferred.reject(err);
          }
        }
      )
      return deferred.promise;
    }
    /*
     Function for granting ALL_PERMISSION to all documents to a user / new organizer
     collection: events, agenda, organizer
     */
    backend.grantAllPermission = function (username) {
      BaasBox.loadAllCollection("events").done(function (resevent) {
        for (i = 0; i < resevent.length; i++) {
          BaasBox.grantUserAccessToObject("events", resevent[i].id, BaasBox.ALL_PERMISSION, username);
        }
      })
      BaasBox.loadAllCollection("agenda").done(function (resagenda) {
        for (i = 0; i < resagenda.length; i++) {
          BaasBox.grantUserAccessToObject("agenda", resagenda[i].id, BaasBox.ALL_PERMISSION, username);
        }
      })
      BaasBox.loadAllCollection("organizer").done(function (resorg) {
        for (i = 0; i < resorg.length; i++) {
          BaasBox.grantUserAccessToObject("organizer", resorg[i].id, BaasBox.ALL_PERMISSION, username);
        }
      })
    }
    return backend;
  }
);
