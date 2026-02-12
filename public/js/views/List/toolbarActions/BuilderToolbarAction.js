// @flow
import {action} from 'mobx';
import { translate } from 'sulu-admin-bundle/utils/Translator';
import AbstractFormToolbarAction from 'sulu-admin-bundle/views/Form/toolbarActions/AbstractFormToolbarAction';

export default class BuilderToolbarAction extends AbstractFormToolbarAction {
    _messageHandler = null;
    _pendingHtml = null;
    _pendingCss = null;
    _isBuilderDirty = false;
    _originalSave = null;

    constructor(resourceStore, formStore, router, options, locales) {
        super(resourceStore, formStore, router, options, locales);
        this.resourceStore = resourceStore;
        this.formStore = formStore;

        this._setupMessageListener();
        this._overrideSave();
    }

    /**
     * Listens for postMessage events from the GrapeJS builder (iframe preview).
     *
     * - sulu-grapes-pending: data sent silently on each modification.
     *   The parent stores the data and marks the FormStore dirty (no preview re-render).
     *
     * - sulu-grapes-update: full sync triggered by the Sync button or Ctrl+S.
     *   Data is injected into the FormStore via changeMultiple (triggers a re-render).
     */
    _setupMessageListener() {
        this._messageHandler = (event) => {
            if (event.origin !== window.location.origin) return;
            if (!event.data?.type) return;

            if (event.data.type === 'sulu-grapes-pending') {
                // Silently store pending data
                this._pendingHtml = event.data.html;
                this._pendingCss = event.data.css;

                // Mark dirty ONCE (same value = no MobX re-render)
                if (!this._isBuilderDirty) {
                    this._isBuilderDirty = true;
                    const currentHtml = this.resourceFormStore.data.json_builder_html || '';
                    this.resourceFormStore.change('json_builder_html', currentHtml);
                }
            }

            if (event.data.type === 'sulu-grapes-update') {
                // Explicit full sync (Sync button or Ctrl+S)
                const { html, css } = event.data;
                this.resourceFormStore.changeMultiple({
                    json_builder_html: html,
                    json_builder_css: css,
                });
                this._pendingHtml = null;
                this._pendingCss = null;
            }
        };
        window.addEventListener('message', this._messageHandler);
    }

    /**
     * Intercepts the FormStore save to inject pending builder data
     * BEFORE the actual save. Allows saving via Sulu even without
     * clicking Sync first.
     *
     * Wrapped in a MobX action to batch changes and prevent
     * reactions (preview update) from firing between changeMultiple and save.
     */
    _overrideSave() {
        this._originalSave = this.resourceFormStore.save.bind(this.resourceFormStore);

        this.resourceFormStore.save = action('builderInjectPendingAndSave', (...args) => {
            if (this._pendingHtml !== null) {
                this.resourceFormStore.changeMultiple({
                    json_builder_html: this._pendingHtml,
                    json_builder_css: this._pendingCss,
                });
                this._pendingHtml = null;
                this._pendingCss = null;
            }
            this._isBuilderDirty = false;
            return this._originalSave(...args);
        });
    }

    destroy() {
        if (this._messageHandler) {
            window.removeEventListener('message', this._messageHandler);
        }
        // Restore original save method
        if (this._originalSave) {
            this.resourceFormStore.save = this._originalSave;
        }
    }

    getToolbarItemConfig() {
        const template = this.resourceFormStore.data.template;

        if (!template || template !== 'builder') {
            return null;
        }

        // The "Open Builder" button only appears when standalone mode is enabled.
        // The postMessage listener (constructor) is always active for preview mode.
        if (!this.options.enableStandaloneBuilder) {
            return null;
        }

        return {
            icon: 'su-magic',
            label: translate('itech_world.grapesjs.open_builder'),
            onClick: () => {
                const id = this.resourceFormStore.id;
                const locale = this.resourceFormStore.locale;
                const webspace = this.resourceFormStore.options?.webspace;

                if (!id || !locale || !webspace) {
                    console.warn('[BuilderToolbarAction] id, locale or webspace missing');
                    return;
                }

                const url = `/admin/page-builder/${webspace}/${locale}/${id}`;
                window.open(url, '_blank');
            },
            type: 'button',
        };
    }
}
