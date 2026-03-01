NAME    := github-pr-colorizer
VERSION := $(shell grep '"version"' manifest.json | head -1 | sed 's/.*: *"\(.*\)".*/\1/')
ZIPFILE := $(NAME)-$(VERSION).zip

# Files that ship in the extension
SRC := manifest.json content.js palette.js popup.html popup.css popup.js images/

.PHONY: package clean version

package: clean
	@echo "Packaging $(ZIPFILE)..."
	zip -r $(ZIPFILE) $(SRC)
	@du -h $(ZIPFILE) | awk '{print "Done → $(ZIPFILE) (" $$1 ")"}'

clean:
	rm -f $(NAME)-*.zip

version:
	@echo $(VERSION)
