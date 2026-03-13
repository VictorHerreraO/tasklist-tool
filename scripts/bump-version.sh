#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

# Function to display usage
usage() {
    echo "Usage: $0 <new_version>"
    echo "Example: $0 0.1.3"
    exit 1
}

# Check if a version was provided
if [ -z "$1" ]; then
    echo "Error: No version provided."
    usage
fi

NEW_VERSION=$1

# Basic regex validation for semantic versioning (x.y.z)
if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Error: Version must be in the format x.y.z (e.g., 0.1.3)"
    usage
fi

echo "Updating version to $NEW_VERSION across the monorepo..."

# List of package.json files to update
FILES=(
    "package.json"
    "packages/core/package.json"
    "packages/extension/package.json"
    "packages/mcp/package.json"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "Updating $file..."
        # Use a temporary file to hold the output then overwrite
        # Using jq to elegantly update the top-level "version" field
        jq ".version = \"$NEW_VERSION\"" "$file" > "${file}.tmp" && mv "${file}.tmp" "$file"
    else
        echo "Warning: $file not found!"
    fi
done

# Update hardcoded version in MCP server.ts
MCP_SERVER_FILE="packages/mcp/src/server.ts"
if [ -f "$MCP_SERVER_FILE" ]; then
    echo "Updating $MCP_SERVER_FILE..."
    # Update version: 'x.y.z' to the new version
    sed -i '' "s/version: '[0-9]*\.[0-9]*\.[0-9]*'/version: '$NEW_VERSION'/g" "$MCP_SERVER_FILE"
else
    echo "Warning: $MCP_SERVER_FILE not found!"
fi

echo ""
echo "Version successfully updated to $NEW_VERSION in all package files."
echo "Please remember to:"
echo "  1. Run 'npm install' to update package-lock.json if necessary."
echo "  2. Commit the changes: git commit -am \"bump version to $NEW_VERSION\""

