import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {JiraIndicator} from './src/indicator.js';
import {JiraService} from './src/jiraService.js';
import {ExtensionSettings} from './src/types.js';

export default class JiraIssueExtension extends Extension {
    private indicator?: any;
    private jiraService?: JiraService;
    private settings?: Gio.Settings;
    private pollSourceId?: number;
    private settingsChangedIds: number[] = [];

    enable() {
        console.log('Extension: Starting enable()');
        
        this.settings = this.getSettings();
        console.log('Extension: Settings loaded');
        
        // Create services
        this.jiraService = new JiraService(this._getSettingsObject());
        console.log('Extension: JiraService created');
        
        // Create indicator
        this.indicator = new JiraIndicator({
            settings: this.settings,
            openPrefsCallback: this.openPreferences.bind(this)
        });
        console.log('Extension: JiraIndicator created');

        // Connect to refresh requests from indicator
        this.indicator.connect('refresh-requested', () => {
            this._refreshIssues();
        });

        // Watch for settings changes
        this._connectSettings();

        // Load indicator into panel after a short delay to ensure shell is ready
        console.log('Extension: Scheduling indicator load in 2 seconds');
        GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
            console.log('Extension: Loading indicator into panel');
            this._loadIndicator();
            
            // Start polling after indicator is loaded
            this._startPolling();
            
            // Do initial refresh
            console.log('Extension: Scheduling initial refresh in 1 more second');
            GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
                console.log('Extension: Executing initial refresh');
                this._refreshIssues();
                return GLib.SOURCE_REMOVE;
            });
            
            return GLib.SOURCE_REMOVE;
        });
    }

    disable() {
        // Stop polling
        this._stopPolling();

        // Disconnect settings
        this._disconnectSettings();

        // Remove indicator from panel
        this._unloadIndicator();

        // Cleanup services
        if (this.jiraService) {
            this.jiraService.destroy();
            this.jiraService = undefined;
        }

        // Cleanup indicator
        if (this.indicator) {
            this.indicator.destroy();
            this.indicator = undefined;
        }

        this.settings = undefined;
    }

    private _getSettingsObject(): ExtensionSettings {
        if (!this.settings) {
            throw new Error('Settings not initialized');
        }

        return {
            jiraUrl: this.settings.get_string('jira-url'),
            jiraEmail: this.settings.get_string('jira-email'),
            jiraToken: this.settings.get_string('jira-token'),
            jqlQuery: this.settings.get_string('jql-query'),
            pollInterval: this.settings.get_int('poll-interval'),
            issueFormat: this.settings.get_string('issue-format'),
            noIssuesText: this.settings.get_string('no-issues-text'),
            panelPosition: this.settings.get_int('panel-position'),
        };
    }

    private _connectSettings() {
        if (!this.settings) return;

        // Watch for settings changes that require service update
        const serviceSettings = ['jira-url', 'jira-email', 'jira-token', 'jql-query', 'issue-format'];
        serviceSettings.forEach(key => {
            const id = this.settings!.connect(`changed::${key}`, () => {
                if (this.jiraService) {
                    this.jiraService.updateSettings(this._getSettingsObject());
                    this._refreshIssues();
                }
            });
            this.settingsChangedIds.push(id);
        });

        // Watch for poll interval changes
        const pollId = this.settings.connect('changed::poll-interval', () => {
            this._restartPolling();
        });
        this.settingsChangedIds.push(pollId);

        // Watch for panel position changes
        const panelId = this.settings.connect('changed::panel-position', () => {
            console.log('Extension: Panel position changed, reloading indicator');
            this._unloadIndicator();
            // Small delay to ensure clean removal before re-adding
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
                this._loadIndicator();
                return GLib.SOURCE_REMOVE;
            });
        });
        this.settingsChangedIds.push(panelId);

        // Watch for display text changes
        const displaySettings = ['no-issues-text', 'issue-format'];
        displaySettings.forEach(key => {
            const id = this.settings!.connect(`changed::${key}`, () => {
                this._refreshIssues();
            });
            this.settingsChangedIds.push(id);
        });
    }

    private _disconnectSettings() {
        if (!this.settings) return;

        this.settingsChangedIds.forEach(id => {
            this.settings!.disconnect(id);
        });
        this.settingsChangedIds = [];
    }

    private _loadIndicator() {
        console.log('Extension: _loadIndicator() called');
        
        if (!this.indicator || !this.settings) {
            console.log('Extension: Cannot load indicator - missing indicator or settings', {
                hasIndicator: !!this.indicator,
                hasSettings: !!this.settings
            });
            return;
        }

        // Make sure indicator isn't already in a panel
        const currentParent = this.indicator.get_parent();
        if (currentParent) {
            console.log('Extension: Indicator already has parent, removing first');
            currentParent.remove_child(this.indicator);
        }

        const boxes = [
            (Main.panel as any)._leftBox,
            (Main.panel as any)._centerBox,
            (Main.panel as any)._rightBox,
        ];

        const position = this.settings.get_int('panel-position');
        const targetBox = boxes[position] || boxes[2]; // Default to right
        
        console.log('Extension: Loading indicator into panel position:', position);

        // For left panel, insert after activities button (index 1)
        // For center and right, insert at the beginning (index 0)
        const index = position === 0 ? 1 : 0;

        try {
            targetBox.insert_child_at_index(this.indicator, index);
            console.log('Extension: Indicator successfully added to panel');
        } catch (error) {
            console.error('Extension: Failed to add indicator to panel:', error);
        }
    }

    private _unloadIndicator() {
        console.log('Extension: _unloadIndicator() called');
        
        if (!this.indicator) {
            console.log('Extension: No indicator to unload');
            return;
        }

        const parent = this.indicator.get_parent();
        if (parent) {
            console.log('Extension: Removing indicator from panel');
            parent.remove_child(this.indicator);
        } else {
            console.log('Extension: Indicator has no parent to remove from');
        }
    }

    private _startPolling() {
        this._stopPolling();

        if (!this.settings) return;

        const interval = this.settings.get_int('poll-interval');
        this.pollSourceId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            interval,
            () => {
                this._refreshIssues();
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    private _stopPolling() {
        if (this.pollSourceId) {
            GLib.Source.remove(this.pollSourceId);
            this.pollSourceId = undefined;
        }
    }

    private _restartPolling() {
        this._stopPolling();
        this._startPolling();
    }

    private async _refreshIssues() {
        console.log('Extension: Starting _refreshIssues()');
        
        if (!this.indicator || !this.jiraService) {
            console.log('Extension: Missing indicator or jiraService', {
                hasIndicator: !!this.indicator,
                hasJiraService: !!this.jiraService
            });
            return;
        }

        const settings = this._getSettingsObject();
        console.log('Extension: Current settings', {
            hasJiraUrl: !!settings.jiraUrl,
            jiraUrl: settings.jiraUrl,
            hasJiraEmail: !!settings.jiraEmail,
            jiraEmail: settings.jiraEmail,
            hasJiraToken: !!settings.jiraToken,
            tokenLength: settings.jiraToken ? settings.jiraToken.length : 0,
            jqlQuery: settings.jqlQuery,
            pollInterval: settings.pollInterval
        });

        // Check if we have required settings
        if (!settings.jiraUrl || !settings.jiraEmail || !settings.jiraToken) {
            console.log('Extension: Missing required configuration');
            this.indicator.showError('Configuration required');
            return;
        }

        console.log('Extension: Showing loading state and starting API call');
        this.indicator.showLoading();

        try {
            const issues = await this.jiraService.searchIssues();
            console.log('Extension: API call successful, received', issues.length, 'issues');
            
            if (issues.length > 0) {
                console.log('Extension: Displaying first issue:', issues[0].key);
                // Show the first issue
                this.indicator.updateIssue(issues[0]);
            } else {
                console.log('Extension: No issues found, showing no-issues state');
                // No issues found
                this.indicator.updateIssue(null);
            }
        } catch (error) {
            console.error('Extension: Failed to fetch Jira issues:', error);
            const fullErrorMessage = this._getErrorMessage(error);
            const shortErrorMessage = this._getShortErrorMessage(error);
            this.indicator.showError(shortErrorMessage, fullErrorMessage);
        }
    }

    private _getErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }
        return 'Unknown error occurred';
    }

    private _getShortErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            const message = error.message.toLowerCase();
            
            if (message.includes('authentication') || message.includes('unauthorized') || message.includes('401')) {
                return 'Authentication Error';
            }
            if (message.includes('forbidden') || message.includes('403')) {
                return 'Access Denied';
            }
            if (message.includes('not found') || message.includes('404')) {
                return 'Jira Not Found';
            }
            if (message.includes('network') || message.includes('connection') || message.includes('timeout')) {
                return 'Connection Error';
            }
            if (message.includes('parse') || message.includes('json')) {
                return 'Response Error';
            }
            if (message.includes('jql') || message.includes('query')) {
                return 'Query Error';
            }
            if (message.includes('configuration') || message.includes('configured')) {
                return 'Configuration Error';
            }
            
            return 'Request Error';
        }
        return 'Unknown Error';
    }
}