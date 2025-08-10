# Jira Issue GNOME Extension

A GNOME Shell extension that displays your current Jira issue in the panel.

## Features

- 🎯 **Single Issue Display**: Shows one issue from your JQL query
- ⚙️ **Configurable**: Jira URL, API token, JQL query, and polling interval  
- 🎨 **Customizable Format**: Control how issues are displayed
- 📍 **Panel Position**: Left, center, or right panel placement
- 🔄 **Auto-refresh**: Polling interval (60 seconds to 1 hour)
- 🖱️ **Click Actions**: Left-click to open issue, right-click for menu

## Installation

```bash
make install
make enable
```

Restart GNOME Shell: `Alt + F2`, type `r`, press Enter

## Configuration

### Required Settings
1. **Jira URL**: Your instance URL (e.g., `https://company.atlassian.net`)
2. **Email**: Your Jira account email
3. **API Token**: [Create one here](https://id.atlassian.com/manage-profile/security/api-tokens)

### JQL Examples
```
assignee = currentUser() AND status = 'In Progress'
assignee = currentUser() AND priority = High
sprint in openSprints() AND assignee = currentUser()
```

## Usage

1. Configure your Jira URL, email and API token
2. Customize the JQL query if needed
3. Left-click to open issue, right-click for menu

## Development

```bash
yarn install    # Install dependencies
make build      # Build extension
```

## Troubleshooting

- **Not appearing**: Restart GNOME Shell, check `make enable`
- **API errors**: Verify URL (include https://), check API token validity
- **Build errors**: Ensure yarn is installed, run `yarn install`

## License

LGPL-3.0-or-later