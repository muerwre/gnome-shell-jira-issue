import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import {JiraIssue, IndicatorState} from './types.js';

class JiraIndicatorClass extends PanelMenu.Button {
    private label!: St.Label;
    private settings!: Gio.Settings;
    private currentIssue: JiraIssue | null = null;
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
        // Open Issue menu item
        const openIssueItem = new PopupMenu.PopupMenuItem(_('Open Issue'));
        openIssueItem.connect('activate', () => {
            if (this.currentIssue) {
                this._openIssueInBrowser();
            }
        });
        (this.menu as any).addMenuItem(openIssueItem);

        // Refresh menu item
        const refreshItem = new PopupMenu.PopupMenuItem(_('Refresh'));
        refreshItem.connect('activate', () => {
            this.emit('refresh-requested');
        });
        (this.menu as any).addMenuItem(refreshItem);

        // Separator
        (this.menu as any).addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Settings menu item
        const settingsItem = new PopupMenu.PopupMenuItem(_('Settings'));
        settingsItem.connect('activate', () => {
            this.openPrefsCallback();
        });
        (this.menu as any).addMenuItem(settingsItem);

        // Update menu visibility based on current state
        this._updateMenuItems();
    }

    private _updateMenuItems() {
        const items = (this.menu as any)._getMenuItems();
        const openIssueItem = items[0] as PopupMenu.PopupMenuItem;
        
        // Enable/disable "Open Issue" based on whether we have a current issue
        openIssueItem.setSensitive(this.currentIssue !== null);
    }

    private _openIssueInBrowser() {
        if (!this.currentIssue) return;

        const jiraUrl = this.settings.get_string('jira-url');
        if (!jiraUrl) return;

        const issueUrl = `${jiraUrl.replace(/\/$/, '')}/browse/${this.currentIssue.key}`;
        
        try {
            Gio.AppInfo.launch_default_for_uri(issueUrl, null);
        } catch (error) {
            console.error('Failed to open issue URL:', error);
        }
    }

    updateState(state: IndicatorState) {
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
                this.label.set_text(`Error: ${state.text}`);
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

    showError(errorMessage: string) {
        this.updateState({
            type: 'error',
            text: errorMessage
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
                // Left click: open issue in browser
                if (this.currentIssue) {
                    this._openIssueInBrowser();
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
        super.destroy();
    }
}

export const JiraIndicator = GObject.registerClass({
    Signals: {
        'refresh-requested': {},
    },
}, JiraIndicatorClass);