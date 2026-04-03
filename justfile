src_dir := "src"

# list all available commands
default:
    @just --list

# 1. DAILY DEV: Quick add, commit, and push
save msg:
    git add .
    git commit -m "{{msg}}"
    git push origin main

# 2. BUMP: Safely update manifest.json version using built-in Python
bump version:
    @echo "Bumping version to {{version}} in manifest.json..."
    @python3 -c "import json; filepath='{{src_dir}}/manifest.json'; data=json.load(open(filepath)); data['version']='{{version}}'; json.dump(data, open(filepath, 'w'), indent=2)"
    @echo "Version bumped!"

# 3. BUILD: Just zip the extension (great for local testing)
zip version:
    @echo "Zipping extension v{{version}}..."
    cd {{src_dir}} && zip -r ../molstar_browser-{{version}}.zip *
    @echo "Zip complete!"

# 4. RELEASE: Bump, commit, tag, push, zip, and release!
publish version:
    #!/usr/bin/env bash
    set -e 
    
    # Step A: Bump the version automatically
    just bump {{version}}
    
    # Step B: Commit the version change
    git add {{src_dir}}/manifest.json
    git commit -m "chore: bump version to v{{version}}" || echo "Version already set to {{version}}."
    
    # Step C: Tag and push to the remote repository
    echo "Tagging and pushing release v{{version}}..."
    git tag v{{version}}
    git push origin main
    git push origin main --tags
    
    # Step D: Build the zip file
    just zip {{version}}
    
    # Step E: Upload to the GitHub release page
    echo "Creating GitHub Release..."
    if command -v gh &>/dev/null; then
        gh release create v{{version}} molstar_browser-{{version}}.zip \
            --title "Release v{{version}}" \
            --generate-notes
        echo "🚀 Release v{{version}} published successfully!"
    else
        echo "⚠️ gh CLI not found. Please upload molstar_browser-{{version}}.zip manually to GitHub."
    fi

# 5. CLEANUP: Remove old zip files
clean:
    rm -f molstar_browser-*.zip
