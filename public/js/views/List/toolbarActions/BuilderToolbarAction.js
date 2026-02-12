// @flow
import React from 'react';
import {action, observable} from 'mobx';
import {translate} from 'sulu-admin-bundle/utils/Translator';
import AbstractFormToolbarAction from 'sulu-admin-bundle/views/Form/toolbarActions/AbstractFormToolbarAction';
import {SingleMediaSelectionOverlay} from 'sulu-media-bundle/containers';

export default class BuilderToolbarAction extends AbstractFormToolbarAction {
    _messageHandler = null;
    _pendingHtml = null;
    _pendingCss = null;
    _isBuilderDirty = false;
    _originalSave = null;
    _iframeSource = null;

    @observable _showMediaOverlay = false;
    @observable _mediaTypes = [];

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
     *
     * - sulu-grapes-open-media: opens the Sulu media overlay for image selection.
     *
     * - sulu-grapes-open-document: opens the Sulu media overlay for document selection.
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
                const {html, css} = event.data;
                this.resourceFormStore.changeMultiple({
                    json_builder_html: html,
                    json_builder_css: css,
                });
                this._pendingHtml = null;
                this._pendingCss = null;
            }

            if (event.data.type === 'sulu-grapes-open-media') {
                this._iframeSource = event.source;
                this._handleOpenMediaOverlay(['image']);
            }

            if (event.data.type === 'sulu-grapes-open-document') {
                this._iframeSource = event.source;
                this._handleOpenMediaOverlay(['document']);
            }
        };
        window.addEventListener('message', this._messageHandler);
    }

    /**
     * Opens the Sulu SingleMediaSelectionOverlay with the given media types.
     *
     * @param {string[]} types Media types to filter (e.g. ['image'] or ['document'])
     */
    @action _handleOpenMediaOverlay = (types) => {
        this._mediaTypes = types;
        this._showMediaOverlay = true;
    };

    /**
     * Handles media selection from the Sulu overlay.
     * Sends the selected media data back to the GrapeJS iframe via postMessage.
     *
     * @param {Object} selectedMedia The media object selected in the overlay
     */
    @action _handleMediaConfirm = (selectedMedia) => {
        if (selectedMedia && this._iframeSource) {
            const mediaType = this._mediaTypes.includes('document') ? 'document' : 'image';

            this._iframeSource.postMessage({
                type: 'sulu-grapes-media-selected',
                media: {
                    id: selectedMedia.id,
                    title: selectedMedia.title,
                    name: selectedMedia.name,
                    url: selectedMedia.url,
                    thumbnails: selectedMedia.thumbnails || {},
                    mimeType: selectedMedia.mimeType,
                    type: mediaType,
                },
            }, window.location.origin);
        }

        this._showMediaOverlay = false;
        this._iframeSource = null;
    };

    /**
     * Handles media overlay close (cancel).
     * Notifies the GrapeJS iframe that the selection was cancelled.
     */
    @action _handleMediaClose = () => {
        if (this._iframeSource) {
            this._iframeSource.postMessage({
                type: 'sulu-grapes-media-cancelled',
            }, window.location.origin);
        }

        this._showMediaOverlay = false;
        this._iframeSource = null;
    };

    /**
     * Returns a React node to render in the Sulu form toolbar area.
     * Renders the SingleMediaSelectionOverlay when _showMediaOverlay is true.
     *
     * @returns {React.Node|null}
     */
    getNode() {
        if (!this._showMediaOverlay) {
            return null;
        }

        return (
            <SingleMediaSelectionOverlay
                locale={this.resourceFormStore.locale}
                onClose={this._handleMediaClose}
                onConfirm={this._handleMediaConfirm}
                open={this._showMediaOverlay}
                types={this._mediaTypes}
            />
        );
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
