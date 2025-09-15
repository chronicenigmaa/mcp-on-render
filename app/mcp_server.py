from fastapi import FastAPI, Request, Header, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
import os
import asyncio
import json
import time

app = FastAPI()
AUTH_TOKEN = os.getenv("AUTH_TOKEN")  # optional: set in Render

def check_auth(authorization: str | None):
    if AUTH_TOKEN:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing bearer token")
        token = authorization.split(" ", 1)[1]
        if token != AUTH_TOKEN:
            raise HTTPException(status_code=403, detail="Invalid token")
@app.get("/healthz")
def healthz():
    return {"ok": True, "ts": int(time.time())}

@app.get("/list_tools")
def list_tools(authorization: str | None = Header(default=None)):
    # Example response you'd adapt to your MCP spec implementation
    check_auth(authorization)
    return JSONResponse({
        "tools": [
            {
                "name": "echo",
                "description": "Echo a message",
                "input_schema": {"type": "object", "properties": {"message": {"type": "string"}}, "required": ["message"]}
            }
        ]
    })

@app.post("/invoke/echo")
async def invoke_echo(request: Request, authorization: str | None = Header(default=None)):
    check_auth(authorization)
    body = await request.json()
    message = body.get("message", "")
    return {"result": f"echo: {message}"}

@app.get("/sse")
async def sse(authorization: str | None = Header(default=None)):
    # Example SSE stream (replace with your MCP SSE transport)
    check_auth(authorization)
    async def event_gen():
        yield f"event: hello\ndata: {json.dumps({'msg':'connected'})}\n\n"
        for i in range(5):
            await asyncio.sleep(1)
            yield f"data: {json.dumps({'tick': i})}\n\n"
        yield "event: bye\ndata: {}\n\n"
    return StreamingResponse(event_gen(), media_type="text/event-stream")