Step 1: Install the WebSSH MCPB Extension into Claude Desktop
Download the .mcpb file from the link you shared (if you haven’t already saved it locally), then simply double-click it. Claude Desktop should automatically detect it and display an installation dialog. Review the configuration settings — pay particular attention to the Port (default is 1985) and the Bearer Token field, which you’ll need to retrieve from WebSSH itself.

Step 2: Get Your Bearer Token from WebSSH
Open WebSSH on your Mac and navigate to Settings → API / MCP Server. Toggle the server ON, then copy the Bearer Token shown there. Paste that token into the Claude Desktop extension configuration dialog before confirming installation.

Step 3: Allow Docker to Initialize
The first time the extension runs, Docker Desktop will pull the container image it needs. This can take a minute or two. You’ll know it’s ready when the extension shows as active in Claude Desktop under Settings → Extensions.