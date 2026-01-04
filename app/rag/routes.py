from flask import Blueprint, request, jsonify, Response, stream_with_context
from app.rag.chatbot import PortfolioChatbot
from app.rag.session_manager import SessionManager
import json

rag_bp = Blueprint("rag", __name__, url_prefix="/api")

# Initialize chatbot and session manager
chatbot = PortfolioChatbot()
session_manager = SessionManager()

@rag_bp.route("/chat", methods=["POST"])
def chat():
    """
    Handle chat requests with streaming support.
    Expected JSON: {"message": "user question", "session_id": "optional_session_id"}
    """
    try:
        data = request.get_json()
        
        if not data or "message" not in data:
            return jsonify({"error": "Message is required"}), 400
        
        user_message = data["message"].strip()
        if not user_message:
            return jsonify({"error": "Message cannot be empty"}), 400
        
        # Get or create session
        session_id = data.get("session_id")
        if not session_id:
            session_id = session_manager.create_session()
        
        # Get conversation history
        history = session_manager.get_history(session_id)
        
        # Generate streaming response
        def generate():
            full_response = ""
            
            try:
                for chunk in chatbot.chat_stream(user_message, history):
                    full_response += chunk
                    # Send SSE format
                    yield f"data: {json.dumps({'chunk': chunk, 'session_id': session_id})}\n\n"
                
                # Save to history after complete
                session_manager.add_message(session_id, "user", user_message)
                session_manager.add_message(session_id, "assistant", full_response)
                
                # Send completion signal
                yield f"data: {json.dumps({'done': True, 'session_id': session_id})}\n\n"
                
            except Exception as e:
                error_msg = f"Error generating response: {str(e)}"
                yield f"data: {json.dumps({'error': error_msg})}\n\n"
        
        return Response(
            stream_with_context(generate()),
            mimetype="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no"
            }
        )
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@rag_bp.route("/chat/history/<session_id>", methods=["GET"])
def get_history(session_id):
    """Get conversation history for a session."""
    try:
        history = session_manager.get_history(session_id)
        return jsonify({"session_id": session_id, "history": history})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@rag_bp.route("/chat/clear/<session_id>", methods=["POST"])
def clear_history(session_id):
    """Clear conversation history for a session."""
    try:
        session_manager.clear_session(session_id)
        return jsonify({"success": True, "message": "History cleared"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
