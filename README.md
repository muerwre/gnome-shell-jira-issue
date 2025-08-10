# Jira Issue GNOME Extension

A GNOME Shell extension for GNOME 48 that displays your current Jira issue in the taskbar.

## Features

- 🎯 **Single Issue Display**: Shows one issue from your JQL query in the taskbar
- ⚙️ **Configurable Settings**: Jira URL, API token, JQL query, and polling interval
- 🎨 **Customizable Format**: Control how issues are displayed (e.g., "PROJ-123 - Task Title")
- 📍 **Panel Position**: Choose between left, center, or right panel placement
- 🔄 **Auto-refresh**: Configurable polling interval (30 seconds to 1 hour)
- 💬 **Custom No-Issues Text**: Set your own message when no issues are found
- 🖱️ **Click Actions**: Left-click to open issue, right-click for menu

## Installation

1. **Build and Install**:
   ```bash
   yarn install
   make install
   ```

2. **Restart GNOME Shell**:
   - Press `Alt + F2`
   - Type `r` and press Enter
   - Or log out and back in

3. **Enable Extension**:
   ```bash
   make enable
   ```
   Or enable manually in GNOME Extensions app

## Configuration

### Required Settings

1. **Jira URL**: Your Jira instance URL (e.g., `https://company.atlassian.net`)
2. **Email Address**: Your Jira account email address
3. **API Token**: Your Jira API token
   - Go to [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
   - Create a new API token
   - Copy the token to the extension settings
   - The extension uses Basic Authentication (email:token) like `curl --user email:token`

### Optional Settings

- **JQL Query**: Default is `assignee = currentUser() AND status = 'In Progress'`
- **Issue Format**: Default is `{key} - {summary}`
- **Poll Interval**: Default is 300 seconds (5 minutes)
- **No Issues Text**: Default is "no issues in progress"
- **Panel Position**: Default is right panel

### JQL Query Examples

- Current user's in-progress issues: `assignee = currentUser() AND status = 'In Progress'`
- High priority issues: `assignee = currentUser() AND priority = High`
- Sprint issues: `sprint in openSprints() AND assignee = currentUser()`
- Recent issues: `assignee = currentUser() AND updated >= -7d`

### Format Placeholders

- `{key}` - Issue key (e.g., PROJ-123)
- `{summary}` - Issue title/summary
- `{status}` - Issue status
- `{assignee}` - Assigned person
- `{priority}` - Issue priority
- `{type}` - Issue type

## Usage

1. **Configure the extension** with your Jira URL and API token
2. **Customize the JQL query** to fetch the issues you want
3. **Choose your display format** and panel position
4. The extension will automatically poll Jira and display the first issue from your query
5. **Click the indicator** to open the issue in your browser
6. **Right-click** for menu options (refresh, settings)

## Development

### Building
```bash
# Install dependencies
yarn install

# Build extension
make build

# Development mode (watch for changes)
make dev

# Install locally
make install

# Create distribution package
make pack
```

### Development Cycle
```bash
# Quick build and install
make dev-install

# View logs
make logs

# Enable/disable
make enable
make disable
```

### Debugging

View GNOME Shell logs:
```bash
journalctl -f -o cat /usr/bin/gnome-shell
```

## Troubleshooting

### Extension Not Appearing
1. Check if installed: `make test-install`
2. Restart GNOME Shell: `Alt+F2`, type `r`
3. Enable extension: `make enable`

### API Errors
1. Verify Jira URL (include https://)
2. Check API token is valid
3. Test JQL query in Jira search
4. Check network connectivity

### Build Errors
1. Ensure yarn is installed
2. Run `yarn install`
3. Check TypeScript version

## File Structure

```
jira-extension/
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── Makefile                  # Build and installation
├── metadata.json             # Extension metadata
├── extension.ts              # Main extension logic
├── prefs.ts                  # Preferences window
├── ambient.d.ts              # Type definitions
├── src/
│   ├── indicator.ts          # Taskbar indicator
│   ├── jiraService.ts        # Jira API integration
│   └── types.ts              # TypeScript interfaces
└── schemas/
    └── org.gnome.shell.extensions.jira-issue.gschema.xml
```

## License

LGPL-3.0-or-later

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request