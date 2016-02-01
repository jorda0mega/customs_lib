//@ sourceURL=customsjs

(function () {
    // Establishes the root object window
    var root = this;

    // Creates object that holds all functionality
    var Customs = function (obj) {
        if (obj instanceof C) return obj;
        if (!(this instanceof C)) return new C(obj);
    };

    // Assigns Customs object to window to make it globally accessible
    root.Customs = Customs;

    // Parses the URL string and assigns it to the USParams property of Customs
    var USParams = Customs.USParams = (_.memoize(function () {
        var parse = function (query, regex) {
            var result = {},
          d = function (s) { return window.decodeURIComponent(s.replace(/\+/g, " ")); },
          e;
            while (e = regex.exec(query)) {
                result[d(e[1])] = d(e[2]);
            }
            return result;
        };
        return parse(parse(window.location.search.substring(1), /([^&=]+)=?([^&]*)/g).USParams, /([^!=]+)=?([^!]*)/g);
    }))();

    // Iterates through all plans available creating a map of ID to Code
    var mapIDToCode = function (obj) {
        var map = {};
        _.map(obj, function (type) {
            _.map(type.Plans, function (plan) {
                map[plan["ID"]] = plan["Code"];
            });
        });
        return map;
    };

    // Partial function that leverages core's error messaging system
    var fail = Customs.Fail = function (msg) {
        msg = "CUSTOMS Error: " + msg;
        displayMessage("ERROR", msg);
        throw new Error(msg);
    };

    // Partial function that leverages core's information messaging system
    var info = Customs.Info = function (msg) {
        msg = "CUSTOMS Info: " + msg;
        displayMessage("INFO", msg);
        console.log(msg);
    };

    // Partial function that leverages core's warning messaging system
    var warn = Customs.Warn = function (msg) {
        var msg = "CUSTOMS Warning: " + msg;
        displayMessage("WARNING", msg);
        console.log(msg);
        isWizardClickNext = function () {
            var btnNextID = GlobalVars["ClientID"].replace("_Content", "_btnNext");
            var btnNext = document.getElementById(btnNextID);
            if (btnNext && btnNext.className != 'disabled')
                return '<input onclick=\"log.clearWarnings();log.Warnings = [];\" type=\"button\" id=\"IgnoreBtn\" value=\"' + lstrIgnoreWarnings + '\" class=\"pointer\" />&nbsp';
            else
                return '<input onclick=\"log.clearWarnings();log.Warnings = [];\" type=\"button\" id=\"IgnoreBtn\" value=\"' + lstrIgnoreWarnings + '\" class=\"pointer\" />&nbsp';
        }
    };

    // Iterates through objects and aggregates all codes per type (e.g. types, plans, options, etc)
    var compileCodes = function (objs) {
        return _.reduce(objs, function (memo, obj) {
            return _.union(memo, [obj.Code]);
        }, []);
    };

    // Checks if the nested child is an object, if so assigns it its parent object.
    // This has become extremely handy to identify which options refer to which plans.
    function iterChildren(obj, parent) {
        if (_.isArray(obj)) {
            assignParent(obj, parent);
            return _.map(obj, function (item) {
                storeParents(item, item);
            });
        }
        return;
    }

    // Assigns the object from which this nested object comes from 
    // (e.g. for plans it assigns the type as the parent)
    function assignParent(objs, parent) {
        return _.map(objs, function (obj) {
            obj.$parent = parent;
        });
    }

    // Recursively iterates through currentSession
    function storeParents(children, parent) {
        _.map(children, function (child) {
            _.trampoline(iterChildren, child, parent);
        });
    }

    function difference(parent, exclude) {
        return _.doWhen((_.existy(exclude) && !_.isEmpty(exclude)), function () {
            return _.difference(parent, exclude);
        });
    }

    // Configuration function that depending on the type of message determines
    // the properties to be passed in to core's log.displayNow function.
    function displayMessage(type, content) {
        var msgTypes = {
            "INFO": Log.INFO,
            "ERROR": Log.ERR,
            "WARNING": Log.WARN
        };

        if (msgTypes[type]) {
            log.displayNow(content, "U_OE_" + type, null, null, msgTypes[type], null, true);
        }
        else {
            displayMessage("ERROR", "InvalidType", "There does not exist a type for the message you are trying to display");
        }
    }

    // Returns whether the election is for LE or not
    var isLE = Customs.isLE = function () {
        return USParams.type === "L";
    };

    // Returns whether the election is for OE or not
    var isOE = Customs.isOE = function () {
        return USParams.type === "B";
    };

    // Default compare function. Codes for plans & options. ID for contacts
    function findByIdentifier(identity) {
        return function (obj) {
            return _.contains(identity, obj.Code) || _.contains(identity, obj.ID);
        };
    }

    // Initializes global objects currentSession & contacts once the document is ready
    Customs.Init = _.once(function (currentSession, contacts) {
        // Creates map of plan ids to codes
        var IDToCode = mapIDToCode(currentSession.Types);

        // Given a plan code returns its id
        var ID = Customs.ID = function (code) {
            var id = _.dictionary(_.invert(IDToCode))(code);
            if (!(_.existy(id))) fail("The ID by which you are trying to look up a plan does not exist.");
            return parseInt(id, 10);
        };

        // Given a plan id returns its code
        var Code = Customs.Code = function (id) {
            var code = _.dictionary(IDToCode)(id);
            if (!(_.existy(code))) fail("The Code by which you are trying to look up a plan does not exist.");
            return code;
        };

        // Extending & modifying core global objects 
        var TYPES = _.extend(currentSession.Types);
        var PLANS = _.extend(currentSession.Types[dedTypeIndex].Plans);
        var PLAN_CODES = compileCodes(PLANS);
        var OPTIONS = _.reduce(PLANS, function (memo, plan) {
            return _.union(memo, plan.BenefitOptions);
        }, []);
        var OPTION_CODES = compileCodes(OPTIONS);
        var CONTACTS = _.extend(contacts);
        var CONTACT_IDS = _.reduce(CONTACTS, function (memo, contact) {
            return _.union(memo, contact.ID);
        }, []);

        // Assigning parent property to nested child objects
        storeParents(currentSession, currentSession);

        // Given a currentSession.Plans object returns its UI element
        function getPlanElem(obj) {
            return _.doWhen(_.existy(obj) && _.contains(PLAN_CODES, obj.Code), function () {
                return $('input[id=rdoPlans' + ID(obj.Code) + ']');
            });
        }

        // Given a currentSession.BenefitOptions object returns its UI element
        function getOptionElem(obj) {
            return _.doWhen(_.existy(obj) && _.contains(OPTION_CODES, obj.Code), function () {
                return $('input[value=' + obj.Code + '][name=PlanID' + ID(obj.$parent.Code) + '][id^=rdoOption]');
            });
        }

        // Given a contacts object returns its UI element
        function getContactElem(obj) {
            return _.doWhen(_.existy(obj) && _.contains(CONTACT_IDS, obj.ID), function () {
                return $('tr[id=' + obj.ID + ']').find('input[id^=chkDep]');
            });
        }

        // General function for UI element retrieval
        var getElem = _.dispatch(getPlanElem, getOptionElem, getContactElem);

        // Returns a type given a predicate function
        var getType = _.partial(_.filter, TYPES);

        // Returns a plan given a predicate function
        var getPlan = _.partial(_.filter, PLANS);

        // Returns a benefit option given a predicate function
        var getOption = _.partial(_.filter, OPTIONS);

        // Returns a contact given a predicate function
        var getContact = _.partial(_.filter, CONTACTS);

        // General function for object retrieval
        var get = _.dispatch(getType, getPlan, getOption, getContact);

        // Hides plan UI element given a plan object
        var hidePlan = function (obj) {
            var elem = getPlanElem(obj);
            return _.doWhen((_.existy(elem) && elem.length !== 0), function () {
                elem.parents('tr').hide();
                elem.parents('tr').next('tr').hide();
                return elem;
            });
        };

        // Returns all other types but the ones passed in
        var filterType = function (objs) {
            return _.doWhen(!_.isEmpty(_.intersection(TYPES, objs)), function () {
                return difference(TYPES, objs);
            });
        };

        // Returns all other plans but the ones passed in
        var filterPlan = function (objs) {
            return _.doWhen(!_.isEmpty(_.intersection(PLANS, objs)), function () {
                return difference(PLANS, objs);
            });
        };

        // Returns all other benefit options but the ones passed in
        var filterOption = function (objs) {
            return _.doWhen(!_.isEmpty(_.intersection(OPTIONS, objs)), function () {
                return difference(OPTIONS, objs);
            });
        };

        // Returns all other contacts but the ones passed in
        var filterContact = function (objs) {
            return _.doWhen(!_.isEmpty(_.intersection(CONTACTS, objs)), function () {
                return difference(CONTACTS, objs);
            });
        }

        // Hides the benefit option UI element given a benefit option object
        // Note: if all benefit options are hidden for a plan then the plan
        // will be hidden as well
        var hideOption = function hideOption(obj) {
            var elem = getOptionElem(obj);
            return _.doWhen((_.existy(elem) && elem.length !== 0), function () {
                elem.closest('tr').css("display", "none");
                var section = elem.parents('table[id=tblOptions' + obj.$parent.ID + ']');
                var options = $(section).find('tr').filter(function () { return $(this).css("display") != "none" });
                getPlanElem(obj.$parent).click(function () {
                    return hideOption(obj);
                });
                return _.doWhen((options.length === 0), function () {
                    return hidePlan(obj.$parent);
                });
            });
        };

        // Hides the contact UI element given a contact object
        var hideContact = function hideContact(obj) {
            var elem = getContactElem(obj);
            $('input[id^=rdoOption]').click(function () {
                return hideContact(obj);
            });
            return _.doWhen((_.existy(elem) && elem.length !== 0), function () {
                elem.closest('tr').hide();
            });
        }

        // General hide that hides any UI element depending on the
        // object passed in
        var hide = function (objs) {
            return _.map(objs, _.dispatch(hidePlan, hideOption, hideContact));
        };

        // Disables contact UI elements depending on the contact object
        // passed in
        function disableContacts(obj) {
            var elem = getElem(obj);
            $('input[id^=rdoOption]').click(function () {
                disableContacts(obj);
            });
            return elem.disable();
        }

        // Disables plans and benefit options UI elements depending on the
        // object passed in
        function disablePlansOptions(obj) {
            var elem = getElem(obj);
            var parentElem = getElem(obj.$parent);
            return _.doWhen(_.existy(parentElem), function () {
                parentElem.click(function () {
                    disablePlansOptions(obj);
                });
                return elem.disable();
            });
        }

        // General disable that disables any UI element depending on the
        // object passed in
        var disable = function (objs) {
            return _.map(objs, _.dispatch(disablePlansOptions, disableContacts));
        };

        // Clicks on a UI element depending on the object passed in
        var electElem = function electElem(obj) {
            var elem = (getElem(obj)).not(':checked');
            if (!_.isEmpty(elem)) {
                if (elem.is(':disabled')) {
                    electElem(obj.$parent);
                }
                return elem.click();
            }
            return undefined;
        }

        // General elect that clicks on any UI element depending on the
        // object passed in
        var elect = function (objs) {
            return _.map(objs, function (obj) {
                var elem = (getElem(obj)).not(':checked');
                elem.click();
            });
        };

        // General filter that returns all but the objects passed in for a
        // certain type of object
        var filter = function (objs) {
            var elems = (_.dispatch(filterType, filterPlan, filterOption, filterContact))(objs);
            hide(elems);
        };

        // Returns objects based on the arguments passed in
        function getter(pred) {
            if (_.isFunction(pred)) {
                return get(pred);
            }
            else if (_.isString(pred)) {
                return getter(findByIdentifier([pred]));
            }
            else if (_.isArray(pred)) {
                return getter(findByIdentifier(pred));
            }
            else {
                return fail("Input must be of type [Array|String|Function]");
            }
        }

        // Configuration function that performs the action passed in for the
        // list of objects returned by the predicate
        function modifier(mod) {
            return function () {
                var objs = _.reduce(arguments, function (memo, arg) {
                    return _.union(memo, getter(arg));
                }, []);
                return _.existy(mod) ? mod(objs) : objs;
            };
        }

        // Executes the functions of the object passed in
        // per session type and type
        function setup(setupObj) {
            return _.doWhen(_.existy(setupObj), function () {
                var sessionHandler = setupObj[currentSession.SessionType];
                var typeHandler = null;
                if (_.existy(sessionHandler)) {
                    typeHandler = sessionHandler[currentSession.Types[dedTypeIndex].Code];
                }
                else {
                    typeHandler = setupObj[currentSession.Types[dedTypeIndex].Code];
                }
                return _.doWhen(_.existy(typeHandler), typeHandler);
            });
        }

        // Creating get function
        Customs.Get = modifier();

        // Creating hide function
        Customs.Hide = modifier(hide);

        // Creating filter function
        Customs.Filter = modifier(filter);

        // Creating disable function
        Customs.Disable = modifier(disable);

        // Creating elect function
        Customs.Elect = modifier(elect);

        // Creating setup function
        Customs.Setup = setup;
    });
}).call(window);
