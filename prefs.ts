import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import {
    ExtensionPreferences,
    gettext as _,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class JiraIssuePreferences extends ExtensionPreferences {
    private settings?: Gio.Settings;

    fillPreferencesWindow(window: Adw.PreferencesWindow) {
        this.settings = this.getSettings();

        // Create pages
        const generalPage = this._createGeneralPage();
        const displayPage = this._createDisplayPage();

        window.add(generalPage);
        window.add(displayPage);
    }

    private _createGeneralPage(): Adw.PreferencesPage {
        const page = new Adw.PreferencesPage({
            title: _('General'),
            iconName: 'preferences-system-symbolic',
        });

        // Connection settings group
        const connectionGroup = new Adw.PreferencesGroup({
            title: _('Jira Connection'),
            description: _('Configure your Jira instance connection'),
        });
        page.add(connectionGroup);

        // Jira URL
        const jiraUrlRow = new Adw.EntryRow({
            title: _('Jira URL'),
            text: this.settings!.get_string('jira-url'),
        });
        jiraUrlRow.connect('changed', () => {
            this.settings!.set_string('jira-url', jiraUrlRow.get_text());
        });
        connectionGroup.add(jiraUrlRow);

        // Jira Email
        const jiraEmailRow = new Adw.EntryRow({
            title: _('Email Address'),
            text: this.settings!.get_string('jira-email'),
        });
        jiraEmailRow.connect('changed', () => {
            this.settings!.set_string('jira-email', jiraEmailRow.get_text());
        });
        connectionGroup.add(jiraEmailRow);

        // Jira Token
        const jiraTokenRow = new Adw.PasswordEntryRow({
            title: _('API Token'),
            text: this.settings!.get_string('jira-token'),
        });
        jiraTokenRow.connect('changed', () => {
            this.settings!.set_string('jira-token', jiraTokenRow.get_text());
        });
        connectionGroup.add(jiraTokenRow);

        // Query settings group
        const queryGroup = new Adw.PreferencesGroup({
            title: _('Query Settings'),
            description: _('Configure how issues are fetched'),
        });
        page.add(queryGroup);

        // JQL Query
        const jqlQueryRow = new Adw.EntryRow({
            title: _('JQL Query'),
            text: this.settings!.get_string('jql-query'),
        });
        jqlQueryRow.connect('changed', () => {
            this.settings!.set_string('jql-query', jqlQueryRow.get_text());
        });
        queryGroup.add(jqlQueryRow);

        // Add helpful text for JQL
        const jqlHelpLabel = new Gtk.Label({
            label: _('Examples:\n• assignee = currentUser() AND status = "In Progress"\n• project = "PROJ" AND assignee = currentUser()\n• assignee = currentUser() AND priority = High'),
            wrap: true,
            xalign: 0,
            margin_start: 12,
            margin_end: 12,
            margin_top: 6,
            margin_bottom: 12,
        });
        jqlHelpLabel.add_css_class('dim-label');
        jqlHelpLabel.add_css_class('caption');
        queryGroup.add(jqlHelpLabel);

        // Poll interval
        const pollIntervalRow = new Adw.SpinRow({
            title: _('Poll Interval'),
            subtitle: _('How often to check for updates (seconds)'),
            adjustment: new Gtk.Adjustment({
                lower: 30,
                upper: 3600,
                stepIncrement: 30,
                value: this.settings!.get_int('poll-interval'),
            }),
        });
        this.settings!.bind(
            'poll-interval',
            pollIntervalRow,
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );
        queryGroup.add(pollIntervalRow);

        // Navigation settings group
        const navGroup = new Adw.PreferencesGroup({
            title: _('Navigation'),
            description: _('Configure navigation URLs'),
        });
        page.add(navGroup);

        // Homepage URL
        const homepageUrlRow = new Adw.EntryRow({
            title: _('Homepage URL'),
            text: this.settings!.get_string('homepage-url'),
        });
        homepageUrlRow.connect('changed', () => {
            this.settings!.set_string('homepage-url', homepageUrlRow.get_text());
        });
        navGroup.add(homepageUrlRow);

        // Add helpful text for homepage URL
        const homepageHelpLabel = new Gtk.Label({
            label: _('URL to open when no issues are found or for "Show All Issues".\nCan be full URL (https://...) or relative path (/jira/your-work).\nLeave empty to use main Jira URL.\n\nExamples:\n• https://company.atlassian.net/jira/your-work\n• /secure/RapidBoard.jspa\n• /jira/dashboards'),
            wrap: true,
            xalign: 0,
            margin_start: 12,
            margin_end: 12,
            margin_top: 6,
            margin_bottom: 12,
        });
        homepageHelpLabel.add_css_class('dim-label');
        homepageHelpLabel.add_css_class('caption');
        navGroup.add(homepageHelpLabel);

        return page;
    }

    private _createDisplayPage(): Adw.PreferencesPage {
        const page = new Adw.PreferencesPage({
            title: _('Display'),
            iconName: 'preferences-desktop-display-symbolic',
        });

        // Format settings group
        const formatGroup = new Adw.PreferencesGroup({
            title: _('Issue Display'),
            description: _('Configure how issues are displayed in the panel'),
        });
        page.add(formatGroup);

        // Issue format
        const issueFormatRow = new Adw.EntryRow({
            title: _('Issue Format'),
            text: this.settings!.get_string('issue-format'),
        });
        issueFormatRow.connect('changed', () => {
            this.settings!.set_string('issue-format', issueFormatRow.get_text());
        });
        formatGroup.add(issueFormatRow);

        // Add helpful text for format
        const formatHelpLabel = new Gtk.Label({
            label: _('Available placeholders:\n• {key} - Issue key (e.g., PROJ-123)\n• {summary} - Issue title\n• {status} - Issue status\n• {assignee} - Assigned person\n• {priority} - Issue priority\n• {type} - Issue type'),
            wrap: true,
            xalign: 0,
            margin_start: 12,
            margin_end: 12,
            margin_top: 6,
            margin_bottom: 12,
        });
        formatHelpLabel.add_css_class('dim-label');
        formatHelpLabel.add_css_class('caption');
        formatGroup.add(formatHelpLabel);

        // No issues text
        const noIssuesTextRow = new Adw.EntryRow({
            title: _('No Issues Text'),
            text: this.settings!.get_string('no-issues-text'),
        });
        (noIssuesTextRow as any).subtitle = _('Text shown when no issues are found');
        noIssuesTextRow.connect('changed', () => {
            this.settings!.set_string('no-issues-text', noIssuesTextRow.get_text());
        });
        formatGroup.add(noIssuesTextRow);

        // Panel settings group
        const panelGroup = new Adw.PreferencesGroup({
            title: _('Panel Settings'),
            description: _('Configure panel appearance'),
        });
        page.add(panelGroup);

        // Panel position
        const panelPositionRow = new Adw.ComboRow({
            title: _('Panel Position'),
            subtitle: _('Where to place the indicator in the panel'),
        });

        const positionModel = new Gtk.StringList();
        positionModel.append(_('Left'));
        positionModel.append(_('Center'));
        positionModel.append(_('Right'));
        
        panelPositionRow.set_model(positionModel);
        panelPositionRow.set_selected(this.settings!.get_int('panel-position'));
        
        panelPositionRow.connect('notify::selected', () => {
            this.settings!.set_int('panel-position', panelPositionRow.get_selected());
        });
        
        panelGroup.add(panelPositionRow);

        return page;
    }
}