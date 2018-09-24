/* eslint-disable consistent-return,default-case,no-case-declarations,meteor/template-names,meteor/prefix-eventmap-selectors */
import {Meteor} from 'meteor/meteor';
import {Template} from 'meteor/templating';
import {SimpleSchema, SimpleSchemaGroup} from 'simpl-schema';
import {ReactiveVar} from 'meteor/reactive-var';
import {_} from "meteor/erasaur:meteor-lodash";
import moment from 'moment';

import {SimpleSchemaFunctions} from "meteor/corefi:meteor-simple-schema-functions";

import './_includes/autoformHook';
import './autoprofile.html';
import './autoprofile.css';


/* AutoProfile public methods */
function getData (templateInstance) {
    const autoProfileTemplate = templateInstance.parent((instance) => { return instance.view.name === 'Template.autoProfile'; });
    if (autoProfileTemplate) {
        return autoProfileTemplate.data;
    }
}
function getOptions (templateInstance) {
    const data = getData(templateInstance);
    if (data) {
        return data.options;
    }
}
function getContext (templateInstance) {
    const data = getData(templateInstance);
    if (data) {
        return data.myContext;
    }
}

function unifyNamespace (namespace) {
    let ns = [];
    if (namespace) {
        if (typeof namespace === "string") {
            ns = [namespace];
        } else if (namespace instanceof Array) {
            ns = namespace;
        }
    }
    return ns;
}

function getNamespaceContext (context, namespace) {
    if (context) {
        const ns = unifyNamespace(namespace);
        if (ns.length > 0) {
            return context[ns[0]];
        }
    }
    return context;
}

function getFieldValue (templateInstance, id, context, options) {
    if (_.isString(id)) {
        const idSplit = id.split('.');
        const namespace = idSplit.length > 1 ? _.first(idSplit) : null;
        const name = _.last(idSplit);
        const fieldContext = getNamespaceContext(getContext(templateInstance), namespace);
        const profileOptions = getOptions(templateInstance);
        const autoProfileTemplate = templateInstance.parent((instance) => { return instance.view.name === 'Template.autoProfile'; });
        const fieldSchema = SimpleSchemaFunctions.getFieldSchema(profileOptions.collection, id) || SimpleSchemaFunctions.getFieldSchema(profileOptions.collection, id);
        if (fieldContext) {
            const value = fieldContext[name] || context[name];
            if (fieldSchema) {
                const afFieldInput = fieldSchema.autoform ? fieldSchema.autoform.afFieldInput : null;
                if (fieldSchema.type.singleType === Date) {
                    if (options && options.dateformat) {
                        return moment(value).format(options.dateformat);
                    }
                    return moment(value).format("DD.MM.YYYY [um] HH:mm");
                } else if (fieldSchema.type.singleType === String && afFieldInput && afFieldInput.type === "fileUpload") {
                    const collection = window[afFieldInput.collection];
                    if (collection) {
                        const file = collection.find({_id: value}).fetch();
                        if (file && file.length > 0) {
                            return file[0];
                        }
                        return false;
                    }
                }
            } else {
                console.error('getFieldValue: fieldSchema not found', name, id);
            }
            return value;
        }
        console.error('getFieldValue: not found', id, fieldContext);
    }
    return null;
}


// TODO, FIXME: missing cases:
//   - decimal
//   - integer
function getTemplate (templateInstance, context) {
    const profileOptions = getOptions(templateInstance);
    const fullName = context.namespace ? `${context.namespace}.${context.id || context.name}` : context.id || context.name;
    const fieldSchema = SimpleSchemaFunctions.getFieldSchema(profileOptions.collection, fullName) || SimpleSchemaFunctions.getFieldSchema(profileOptions.collection, context.id);
    if (fieldSchema) {
        switch (fieldSchema.type.singleType) {
            case Object: return "autoProfileField_object";
            case Number: return "autoProfileField_string";
            case Date: return "autoProfileField_date";
            case String:
                const autoform = fieldSchema.autoform;
                if (context.reference) {
                    return "autoProfileField_string_reference";
                }
                if (autoform) {
                    if (autoform.rows > 0 || autoform.type === "markdown") {
                        return "autoProfileField_string_textarea";
                    }
                    const afFieldInput = autoform.afFieldInput;
                    if (afFieldInput && afFieldInput.type === "fileUpload") {
                        if (afFieldInput.accept && afFieldInput.accept.substr(0, 6) === "image/") {
                            return "autoProfileField_image";
                        }
                        return "autoProfileField_file";
                    }
                }
                return "autoProfileField_string";
            case Array:
                const subSchema = SimpleSchemaFunctions.getFieldSchema(profileOptions.collection, `${fullName}.$`);
                if (subSchema) {
                    switch (subSchema.type.singleType) {
                        case Object: return "autoProfileField_array_object";
                        case String: return "autoProfileField_array";
                    }
                }
                return "autoProfileField_array";
        }
    } else {
        console.error('getTemplate: fieldSchema not found!', fullName, context.id);
    }
    return "autoProfileField_string";
}


Template.autoProfile.onCreated(function onRendered() {
    window.autoprofileState_FieldId = this.currentFieldId = new ReactiveVar('');
    window.autoprofileState_ArrayIndex = this.currentArrayIndex = new ReactiveVar('');
});

Template.autoProfile.helpers({
    getFields() {
        return Template.instance().currentFieldId.get();
    },
    getContext() {
        return Template.instance().data.myContext;
    }
});

/* AutoProfile Panel */
Template.autoProfilePanel.helpers({
    cardOrPanel() {
        return 'card' || 'panel';
    },
    headerOrHeading() {
        return 'header' || 'heading';
    },
    panelTitle() {
        const profileOptions = getOptions(Template.instance());
        const schema = SimpleSchemaFunctions.getSchema(profileOptions.collection);
        if (this.title) {
            return this.title;
        }
        if (this.field) {
            return _.get(SimpleSchemaFunctions.getFieldSchema(profileOptions.collection, this.field.id), 'label');
        }
    },
    getTemplate() {
        return getTemplate(Template.instance(), this);
    },
});


/* AutoProfile Fields */
Template.autoProfileField_string.helpers({
    options() {
        return getOptions(Template.instance());
    },
    context() {
        return getContext(Template.instance());
    },
    isEditable() {
        let fieldOptions = Template.instance().data.fieldOptions;
        if (!fieldOptions) { fieldOptions = Template.instance().data;}
        return fieldOptions && (typeof fieldOptions.editable === 'undefined' || fieldOptions.editable);
    },
    isUrl() {
        const profileOptions = getOptions(Template.instance());
        const fieldSchema = SimpleSchemaFunctions.getFieldSchema(profileOptions.collection, this.id || this);
        if (fieldSchema && fieldSchema.autoprofile) {
            return fieldSchema.autoprofile.isUrl;
        }
    },
    editingEnabled() {
        const options = getOptions(Template.instance());
        if (options) {
            return options.editingEnabled;
        }
    },
    fieldTitle() {
        const profileOptions = getOptions(Template.instance());
        const fieldSchema = SimpleSchemaFunctions.getFieldSchema(profileOptions.collection, this.id);
        return fieldSchema ? fieldSchema.label : null;
    },
    fieldId() {
        return this.id || this;
    },
    fieldValue() {
        return getFieldValue(Template.instance(), this.id || this, this);
    },
    urlFieldValue() {
        if (this.urlField) {
            return getFieldValue(Template.instance(), this.urlField.id || this.urlField, this);
        }
        return false;
    },
});

Template.autoProfileField_string.events({
    'click .autoprofile-field'(event, templateInstance, doc) {
        const autoProfileTemplate = templateInstance.parent((instance) => { return instance.view.name === 'Template.autoProfile'; });
        const $elem = $(event.currentTarget);
        // TODO: check for autoProfileTemplate.data.options.editingEnabled ?
        if (typeof templateInstance.data.editable === 'undefined' || templateInstance.data.editable) {
            const arrayIndex = $elem.attr('data-array-index');
            autoProfileTemplate.currentArrayIndex.set(arrayIndex);
            autoProfileTemplate.currentFieldId.set(arrayIndex ? `${$elem.closest('[data-field-id]').attr('data-field-id')}.${arrayIndex}` : $elem.attr('data-field-id'));
            Meteor.defer(() => { $('.autoprofile-container .js-user-edit-field-afmodalbutton')[0].click(); });
        }
    }
});


Template.autoProfileFieldHelper_editable.helpers({
    isEditable() {
        const fieldOptions = Template.instance().data.fieldOptions;
        return fieldOptions && (typeof fieldOptions.editable === 'undefined' || fieldOptions.editable);
    }
});


// inherit default helpers
Template.autoProfileField_image.inheritsHelpersFrom('autoProfileField_string');
Template.autoProfileField_file.inheritsHelpersFrom('autoProfileField_string');
Template.autoProfileField_date.inheritsHelpersFrom('autoProfileField_string');
Template.autoProfileField_string_textarea.inheritsHelpersFrom('autoProfileField_string');
Template.autoProfileField_array.inheritsHelpersFrom('autoProfileField_string');
Template.autoProfileField_object.inheritsHelpersFrom('autoProfileField_string');
Template.autoProfileField_array_object.inheritsHelpersFrom('autoProfileField_string');
Template.autoProfileField_string_reference.inheritsHelpersFrom('autoProfileField_string');

// Template.autoProfileFieldHelper_editable.inheritsHelpersFrom('autoProfileField_string');

// inherit default eventmap
Template.autoProfileField_image.inheritsEventsFrom('autoProfileField_string');
Template.autoProfileField_file.inheritsEventsFrom('autoProfileField_string');
Template.autoProfileField_date.inheritsEventsFrom('autoProfileField_string');
Template.autoProfileField_string_textarea.inheritsEventsFrom('autoProfileField_string');
Template.autoProfileField_array.inheritsEventsFrom('autoProfileField_string');
Template.autoProfileField_object.inheritsEventsFrom('autoProfileField_string');
Template.autoProfileField_array_object.inheritsEventsFrom('autoProfileField_string');


/* Extend Field: String ID Reference to different Collection */
Template.autoProfileField_string_reference.helpers({
    referenceUrl() {
        const refId = getFieldValue(Template.instance(), this.id || this, this);
        return this.reference.urlPrefix + refId;
    },
    referenceLabel() {
        const ref = this.reference;
        const refId = getFieldValue(Template.instance(), this.id || this, this);
        if (refId && ref && ref.collection) {
            const relObj = ref.collection.findOne(refId);
            if (relObj) {
                return relObj[ref.labelField && (ref.labelField.id || ref.labelField)];
            }
        }

    },
});

/* Extend Field: AutoProfile array of objects Field */
Template.autoProfileField_array_object.helpers({
    renderInplace() {
        return this.render === "inplace";
    },
    titleFieldValue() {
        const parent = Template.instance().parent();
        if (parent && parent.data && parent.data.data && parent.data.data.titleField) {
            const titleField = parent.data.data.titleField;
            return `<span data-field-id="${titleField.id || titleField}">${getFieldValue(parent, titleField.id || titleField, this)}</span>`;
        }
        return "Error: titleField not set in array of objects context";
    },
    contentFieldValue() {
        const templateInstance = Template.instance();
        const parent = templateInstance.parent();
        if (parent && parent.data && parent.data.data && parent.data.data.subfields && parent.data.data.subfields.length > 0) {
            const subfields = parent.data.data.subfields;
            let value = null;
            for (let i = 0; i < subfields.length; i++) {
                const subfield = subfields[i];
                const templateName = getTemplate(templateInstance, subfield);
                const fieldValue = getFieldValue(parent, subfield.id, this);
                if (templateName === "autoProfileField_file") {
                    const href = `/cdn/storage/${fieldValue._collectionName}/${fieldValue._id}/original/${fieldValue._id}.${fieldValue.extension}`;
                    return `<a href="${href}" target="_blank">${fieldValue.name}</a>`;
                }
                if (i === 0) {
                    value = `<span data-field-id="${subfield.id}">${fieldValue}</span>`;
                } else {
                    value += ` <span data-field-id="${subfield.id}">${fieldValue}</span>`;
                }
            }
            return value;
        }
        return "Error: subfields not Set in array of objects context";
    },
});


Template.autoProfileField_object.helpers({
    fieldValueAsJSON() {
        return JSON.stringify(getFieldValue(Template.instance(), this.id, this));
    }
});