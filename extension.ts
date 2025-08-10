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
        this.settings = this.getSettings();
        
        // Create services
        this.jiraService = new JiraService(this._getSettingsObject());
        
        // Create indicator
        this.indicator = new JiraIndicator({
            settings: this.settings,
            openPrefsCallback: this.openPreferences.bind(this)
        });

        // Connect to refresh requests from indicator
        this.indicator.connect('refresh-requested', () => {
            this._refreshIssues(true); // Show loading for manual refresh
        });

        // Watch for settings changes
        this._connectSettings();

        // Load indicator into panel after a short delay to ensure shell is ready
        GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
            this._loadIndicator();
            
            // Start polling after indicator is loaded
            this._startPolling();
            
            // Do initial refresh
            GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
                this._refreshIssues(true); // Show loading for initial refresh
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
            homepageUrl: this.settings.get_string('homepage-url'),
        };
    }

    private _connectSettings() {
        if (!this.settings) return;

        // Watch for settings changes that require service update
        const serviceSettings = ['jira-url', 'jira-email', 'jira-token', 'jql-query', 'issue-format', 'homepage-url'];
        serviceSettings.forEach(key => {
            const id = this.settings!.connect(`changed::${key}`, () => {
                if (this.jiraService) {
                    this.jiraService.updateSettings(this._getSettingsObject());
                    this._refreshIssues(true); // Show loading for settings changes
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
                this._refreshIssues(true); // Show loading for display settings changes
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
        if (!this.indicator || !this.settings) {
            return;
        }

        // Make sure indicator isn't already in a panel
        const currentParent = this.indicator.get_parent();
        if (currentParent) {
            currentParent.remove_child(this.indicator);
        }

        const boxes = [
            (Main.panel as any)._leftBox,
            (Main.panel as any)._centerBox,
            (Main.panel as any)._rightBox,
        ];

        const position = this.settings.get_int('panel-position');
        const targetBox = boxes[position] || boxes[2]; // Default to right

        // For left panel, insert after activities button (index 1)
        // For center and right, insert at the beginning (index 0)
        const index = position === 0 ? 1 : 0;

        try {
            targetBox.insert_child_at_index(this.indicator, index);
        } catch (error) {
            console.error('Extension: Failed to add indicator to panel:', error);
        }
    }

        private _unloadIndicator() {
        if (!this.indicator) {
            return;
        }
        
        const parent = this.indicator.get_parent();
        if (parent) {
            parent.remove_child(this.indicator);
        }
    }

    private _startPolling() {
        this._stopPolling();

        if (!this.settings) return;

        // Ensure minimum interval of 60 seconds
        const configuredInterval = this.settings.get_int('poll-interval');
        const interval = Math.max(60, configuredInterval);
        
        this.pollSourceId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            interval,
            () => {
                this._refreshIssues(false); // Don't show loading for polling
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

    private async _refreshIssues(showLoading = true) {
        if (!this.indicator || !this.jiraService) {
            return;
        }

        const settings = this._getSettingsObject();

        // Check if we have required settings
        if (!settings.jiraUrl || !settings.jiraEmail || !settings.jiraToken) {
            this.indicator.showError('Configuration required');
            return;
        }

        if (showLoading) {
            this.indicator.showLoading();
        }

        try {
            const issues = await this.jiraService.searchIssues();
            
            if (issues.length > 0) {
                // Show the first issue
                this.indicator.updateIssue(issues[0]);
            } else {
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