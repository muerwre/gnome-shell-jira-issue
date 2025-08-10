import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import {JiraIssue, IndicatorState} from './types.js';

class JiraIndicatorClass extends PanelMenu.Button {
    private label!: St.Label;
    private settings!: Gio.Settings;
    private currentIssue: JiraIssue | null = null;
    private currentState: IndicatorState | null = null;
    private openPrefsCallback!: () => void;

    constructor(props: {settings: Gio.Settings, openPrefsCallback: () => void}) {
        super(0.0, _('Jira Issue Indicator'));
        this.settings = props.settings;
        this.openPrefsCallback = props.openPrefsCallback;
        
        this._buildUI();
        this._buildMenu();
        this.updateState({
            type: 'loading',
            text: 'Loading...'
        });
    }

    private _buildUI() {
        // Create main layout container
        const layout = new St.BoxLayout({
            vertical: false,
            clip_to_allocation: true,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.CENTER,
            reactive: true,
            x_expand: true,
        });

        // Create text label (no icon as requested)
        this.label = new St.Label({
            text: 'Loading...',
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'panel-label'
        });

        layout.add_child(this.label);
        this.add_child(layout);
    }

    private _buildMenu() {
        // Refresh menu item
        const refreshItem = new PopupMenu.PopupMenuItem(_('Refresh'));
        refreshItem.connect('activate', () => {
            this.emit('refresh-requested');
        });
        (this.menu as any).addMenuItem(refreshItem);

        // Settings menu item
        const settingsItem = new PopupMenu.PopupMenuItem(_('Settings'));
        settingsItem.connect('activate', () => {
            this.openPrefsCallback();
        });
        (this.menu as any).addMenuItem(settingsItem);
    }

    private _updateMenuItems() {
        // Menu items are always available - no need to update them
    }

    private _openUrl(url: string) {
        try {
            console.log('Opening URL:', url);
            // Try different methods to open URL
            const success = GLib.spawn_command_line_async(`xdg-open "${url}"`);
            if (!success) {
                console.error('Failed to spawn xdg-open');
                // Fallback to other browsers
                try {
                    GLib.spawn_command_line_async(`firefox "${url}"`);
                } catch (firefoxError) {
                    try {
                        GLib.spawn_command_line_async(`google-chrome "${url}"`);
                    } catch (chromeError) {
                        try {
                            GLib.spawn_command_line_async(`chromium "${url}"`);
                        } catch (chromiumError) {
                            console.error('No browser found to open URL');
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Failed to open URL:', error);
        }
    }

    private _normalizeUrl(url: string): string {
        let normalizedUrl = url.trim();
        
        // Add https:// if no protocol is specified
        if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
            normalizedUrl = `https://${normalizedUrl}`;
        }
        
        // Remove trailing slash
        normalizedUrl = normalizedUrl.replace(/\/$/, '');
        
        return normalizedUrl;
    }

    private _openIssueInBrowser() {
        if (!this.currentIssue) return;

        const jiraUrl = this.settings.get_string('jira-url');
        if (!jiraUrl) return;

        const normalizedUrl = this._normalizeUrl(jiraUrl);
        const issueUrl = `${normalizedUrl}/browse/${this.currentIssue.key}`;
        console.log('Opening issue URL:', issueUrl);
        this._openUrl(issueUrl);
    }

    private _openJiraInBrowser() {
        const jiraUrl = this.settings.get_string('jira-url');
        if (!jiraUrl) return;

        const normalizedUrl = this._normalizeUrl(jiraUrl);
        console.log('Opening Jira URL:', normalizedUrl);
        this._openUrl(normalizedUrl);
    }

    private _showErrorDialog() {
        if (!this.currentState || this.currentState.type !== 'error') return;

        const dialog = new St.Bin({
            style_class: 'modal-dialog',
            reactive: true,
            can_focus: true,
            x_expand: true,
            y_expand: true,
        });

        const content = new St.BoxLayout({
            vertical: true,
            style_class: 'modal-dialog-content-box',
            x_expand: true,
            y_expand: true,
        });

        const title = new St.Label({
            text: _('Jira Extension Error'),
            style_class: 'modal-dialog-headline',
            x_align: Clutter.ActorAlign.CENTER,
        });

        const errorText = new St.Label({
            text: this.currentState.errorDetails || 'Unknown error',
            style_class: 'modal-dialog-body',
            x_align: Clutter.ActorAlign.START,
        });
        errorText.clutter_text.set_line_wrap(true);

        const buttonBox = new St.BoxLayout({
            style_class: 'modal-dialog-button-box',
            x_align: Clutter.ActorAlign.END,
        });

        const okButton = new St.Button({
            label: _('OK'),
            style_class: 'modal-dialog-button',
            reactive: true,
            can_focus: true,
        });

        okButton.connect('clicked', () => {
            const parent = dialog.get_parent();
            if (parent) {
                parent.remove_child(dialog);
            }
        });

        buttonBox.add_child(okButton);
        content.add_child(title);
        content.add_child(errorText);
        content.add_child(buttonBox);
        dialog.set_child(content);

        // Add to the main uiGroup to show as modal
        (global as any).stage.add_child(dialog);
        dialog.grab_key_focus();
    }

    updateState(state: IndicatorState) {
        this.currentState = state;
        
        switch (state.type) {
            case 'loading':
                this.label.set_text('Loading...');
                this.currentIssue = null;
                break;
                
            case 'issue':
                this.label.set_text(state.text);
                this.currentIssue = state.issue || null;
                break;
                
            case 'no-issues':
                this.label.set_text(state.text);
                this.currentIssue = null;
                break;
                
            case 'error':
                this.label.set_text(state.text);
                this.currentIssue = null;
                break;
        }

        this._updateMenuItems();
    }

    updateIssue(issue: JiraIssue | null) {
        if (issue) {
            const format = this.settings.get_string('issue-format');
            const text = this._formatIssue(issue, format);
            this.updateState({
                type: 'issue',
                text,
                issue
            });
        } else {
            const noIssuesText = this.settings.get_string('no-issues-text');
            this.updateState({
                type: 'no-issues',
                text: noIssuesText
            });
        }
    }

    showError(shortMessage: string, fullErrorDetails?: string) {
        this.updateState({
            type: 'error',
            text: shortMessage,
            errorDetails: fullErrorDetails || shortMessage
        });
    }

    showLoading() {
        this.updateState({
            type: 'loading',
            text: 'Loading...'
        });
    }

    private _formatIssue(issue: JiraIssue, format: string): string {
        return format
            .replace('{key}', issue.key)
            .replace('{summary}', issue.fields.summary || 'No summary')
            .replace('{status}', issue.fields.status?.name || 'Unknown')
            .replace('{assignee}', issue.fields.assignee?.displayName || 'Unassigned')
            .replace('{priority}', issue.fields.priority?.name || 'No priority')
            .replace('{type}', issue.fields.issuetype?.name || 'Unknown');
    }

    // Handle clicks on the indicator
    vfunc_event(event: Clutter.Event) {
        if (
            event.type() === Clutter.EventType.TOUCH_END ||
            event.type() === Clutter.EventType.BUTTON_RELEASE
        ) {
            if (event.get_button() === Clutter.BUTTON_PRIMARY) {
                // Left click behavior depends on current state
                if (!this.currentState) {
                    return Clutter.EVENT_PROPAGATE;
                }
                
                switch (this.currentState.type) {
                    case 'issue':
                        // Open specific issue in browser
                        if (this.currentIssue) {
                            this._openIssueInBrowser();
                        }
                        break;
                    case 'no-issues':
                    case 'loading':
                        // Open main Jira URL in browser
                        this._openJiraInBrowser();
                        break;
                    case 'error':
                        // Show error dialog
                        this._showErrorDialog();
                        break;
                }
            } else if (event.get_button() === Clutter.BUTTON_SECONDARY) {
                // Right click: show menu
                this.menu.toggle();
            }
        }

        return Clutter.EVENT_PROPAGATE;
    }

    destroy() {
        this.currentIssue = null;
        this.currentState = null;
        super.destroy();
    }
}

export const JiraIndicator = GObject.registerClass({
    Signals: {
        'refresh-requested': {},
    },
}, JiraIndicatorClass);