NAME=jira-issue
DOMAIN=muerwre.github.com
UUID=$(NAME)@$(DOMAIN)

.PHONY: all pack install clean build dev lint test

all: dist/extension.js

# Install dependencies
node_modules: package.json
	yarn install

# Compile TypeScript
dist/extension.js dist/prefs.js: node_modules $(wildcard src/*.ts) extension.ts prefs.ts ambient.d.ts tsconfig.json
	yarn tsc

# Compile GSettings schema
schemas/gschemas.compiled: schemas/org.gnome.shell.extensions.$(NAME).gschema.xml
	glib-compile-schemas schemas

# Build everything
build: dist/extension.js dist/prefs.js schemas/gschemas.compiled
	@mkdir -p dist/schemas
	@cp -r schemas/* dist/schemas/ 2>/dev/null || true
	@cp metadata.json dist/

# Create extension package
$(NAME).zip: build
	@mkdir -p dist/schemas
	@cp -r schemas/* dist/schemas/
	@cp metadata.json dist/
	@(cd dist && zip ../$(NAME).zip -9r .)

# Package for distribution
pack: $(NAME).zip

# Install extension locally
install: build
	@mkdir -p ~/.local/share/gnome-shell/extensions/$(UUID)
	@cp -r dist/* ~/.local/share/gnome-shell/extensions/$(UUID)/
	@echo "Extension installed to ~/.local/share/gnome-shell/extensions/$(UUID)"
	@echo "You may need to restart GNOME Shell (Alt+F2, type 'r') and enable the extension"

# Uninstall extension
uninstall:
	@rm -rf ~/.local/share/gnome-shell/extensions/$(UUID)
	@echo "Extension uninstalled"

# Development mode with file watching
dev:
	yarn tsc --watch

# Lint code
lint:
	yarn lint

# Fix linting issues
lint-fix:
	yarn lint-fix

# Clean build artifacts
clean:
	@rm -rf dist node_modules $(NAME).zip schemas/gschemas.compiled

# Test installation (just checks if files are in place)
test-install:
	@if [ -d ~/.local/share/gnome-shell/extensions/$(UUID) ]; then \
		echo "✓ Extension is installed"; \
		ls -la ~/.local/share/gnome-shell/extensions/$(UUID)/; \
	else \
		echo "✗ Extension is not installed"; \
		exit 1; \
	fi

# Show extension logs
logs:
	journalctl -f -o cat /usr/bin/gnome-shell

# Enable extension (requires gnome-extensions command)
enable:
	@if command -v gnome-extensions >/dev/null 2>&1; then \
		gnome-extensions enable $(UUID); \
		echo "Extension enabled"; \
	else \
		echo "gnome-extensions command not found. Please enable manually."; \
	fi

# Disable extension
disable:
	@if command -v gnome-extensions >/dev/null 2>&1; then \
		gnome-extensions disable $(UUID); \
		echo "Extension disabled"; \
	else \
		echo "gnome-extensions command not found. Please disable manually."; \
	fi

# Quick development cycle: build and install
dev-install: build install

# Help
help:
	@echo "Available targets:"
	@echo "  build        - Build the extension"
	@echo "  pack         - Create distribution package"
	@echo "  install      - Install extension locally"
	@echo "  uninstall    - Remove extension"
	@echo "  dev          - Start TypeScript compiler in watch mode"
	@echo "  dev-install  - Quick build and install"
	@echo "  lint         - Run ESLint"
	@echo "  lint-fix     - Fix ESLint issues"
	@echo "  test-install - Check if extension is installed"
	@echo "  logs         - Show GNOME Shell logs"
	@echo "  enable       - Enable extension"
	@echo "  disable      - Disable extension"
	@echo "  clean        - Remove build artifacts"
	@echo "  help         - Show this help"