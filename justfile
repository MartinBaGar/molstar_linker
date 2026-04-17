src_dir := "src"
manifests_dir := "manifests"
dist_dir := "dist"
releases_dir := "releases"
docs_dir := "docs"

# list all available commands
default:
	@just --list

# 1. DAILY DEV: Quick add, commit, and push
save msg:
	git add .
	git commit -m "{{msg}}"
	git push origin main

# 2. BUMP: Safely update manifest.json version in both Chrome and Firefox manifests
bump version:
	@echo "Bumping version to {{version}} in manifests..."
	@python3 -c "import json; \
	files=['{{manifests_dir}}/chrome.json', '{{manifests_dir}}/firefox.json']; \
	[ (d.update({'version': '{{version}}'}), json.dump(d, open(f, 'w'), indent=2)) for f in files for d in [json.load(open(f))] ]"
	@echo "✅ Version bumped to {{version}}!"

# 3. BUILD: Compile the src and manifest files into isolated browser directories
build-chrome:
	@mkdir -p {{dist_dir}}/chrome
	@cp -r {{src_dir}}/* {{dist_dir}}/chrome/
	@cp {{manifests_dir}}/chrome.json {{dist_dir}}/chrome/manifest.json
	@echo "✅ Chrome build ready in {{dist_dir}}/chrome/"

build-firefox:
	@mkdir -p {{dist_dir}}/firefox
	@cp -r {{src_dir}}/* {{dist_dir}}/firefox/
	@cp {{manifests_dir}}/firefox.json {{dist_dir}}/firefox/manifest.json
	@echo "✅ Firefox build ready in {{dist_dir}}/firefox/"

build: build-chrome build-firefox

# 4. ZIP: Build and zip the extensions for local testing or manual upload
zip version: build
	@echo "Zipping extensions v{{version}}..."
	@mkdir -p {{releases_dir}}
	@cd {{dist_dir}}/chrome && zip -r ../../{{releases_dir}}/molstar_linker_chrome-v{{version}}.zip * -x "*.DS_Store" > /dev/null
	@cd {{dist_dir}}/firefox && zip -r ../../{{releases_dir}}/molstar_linker_firefox-v{{version}}.zip * -x "*.DS_Store" > /dev/null
	@echo "✅ Zip packages complete in {{releases_dir}}/"

# 5. RELEASE: Bump, commit, tag, push, build, zip, and release!
publish version:
	#!/usr/bin/env bash
	set -e 
	
	# Step A: Bump the version automatically in both manifests
	just bump {{version}}
	
	# Step B: Commit the version change
	git add {{manifests_dir}}/chrome.json {{manifests_dir}}/firefox.json
	git commit -m "chore: bump version to v{{version}}" || echo "Version already set to {{version}}."
	
	# Step C: Tag and push to the remote repository
	echo "Tagging and pushing release v{{version}}..."
	git tag v{{version}}
	git push origin main
	git push origin main --tags
	
	# Step D: Build the clean folders and zip files
	just zip {{version}}
	
	# Step E: Upload BOTH browser versions to the GitHub release page
	echo "Creating GitHub Release..."
	if command -v gh &>/dev/null; then
		gh release create v{{version}} \
			{{releases_dir}}/molstar_linker_chrome-v{{version}}.zip \
			{{releases_dir}}/molstar_linker_firefox-v{{version}}.zip \
			--title "Release v{{version}}" \
			--generate-notes
		echo "🚀 Release v{{version}} published successfully!"
	else
		echo "⚠️ gh CLI not found. Please upload the .zip files from {{releases_dir}} manually to GitHub."
	fi

# 6. CLEANUP: Remove generated build and release folders
clean:
	rm -rf {{dist_dir}} {{releases_dir}}
	@echo "✅ Cleaned up dist/ and releases/ directories."

# 7. Run the local development server
serve:
	@echo "Starting Hugo server in {{docs_dir}}..."
	pixi run hugo server -s {{docs_dir}} -D --disableFastRender

# 8. Build the static site for production
build-site:
	pixi run hugo --minify
