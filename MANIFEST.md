To install it on your Mac:
You need Docker Desktop installed on your Mac. Then:
  1. Download the .mcpb file (you have the link)
  2. Open the .mcpb file — Claude Desktop should launch if installed
  3. Review and adjust the settings (Port, Bearer Token)
  4. Turn on the WebSSH Extension in Claude Desktop
  5. The first time, wait a minute for Docker to pull the container image 
Once running, you can access the MCP endpoints at http://localhost:1985/mcp, and authentication is handled via a Bearer Token found in the API/MCP settings panel within WebSSH.