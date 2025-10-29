dev: ## Start local dev server (serves files and returns 404.html for unknown paths)
	@echo "▶️  Test with user handle: http://[::]:8000/adrien"
	@echo "▶️  Test with user id:     http://[::]:8000/?uId=4d94501d1f78ac091dbc9b4d"
	@echo ""
	@node web-server.js
