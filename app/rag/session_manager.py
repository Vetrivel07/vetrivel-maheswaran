import uuid
from datetime import datetime, timedelta
from threading import Lock

class SessionManager:
    """
    Manages chat sessions with in-memory storage.
    Sessions automatically expire after 1 hour of inactivity.
    """
    
    def __init__(self, session_timeout_minutes=60):
        """
        Initialize session manager.
        
        Args:
            session_timeout_minutes (int): Minutes before session expires
        """
        self.sessions = {}  # {session_id: {"history": [], "last_active": datetime}}
        self.lock = Lock()
        self.timeout = timedelta(minutes=session_timeout_minutes)
    
    def create_session(self):
        """
        Create a new session.
        
        Returns:
            str: New session ID
        """
        session_id = str(uuid.uuid4())
        
        with self.lock:
            self.sessions[session_id] = {
                "history": [],
                "last_active": datetime.now()
            }
        
        return session_id
    
    def get_history(self, session_id):
        """
        Get conversation history for a session.
        
        Args:
            session_id (str): Session ID
        
        Returns:
            list: Conversation history or empty list if session not found
        """
        with self.lock:
            # Clean up expired sessions
            self._cleanup_expired_sessions()
            
            if session_id not in self.sessions:
                return []
            
            # Update last active time
            self.sessions[session_id]["last_active"] = datetime.now()
            
            return self.sessions[session_id]["history"].copy()
    
    def add_message(self, session_id, role, content):
        """
        Add a message to session history.
        
        Args:
            session_id (str): Session ID
            role (str): "user" or "assistant"
            content (str): Message content
        
        Returns:
            bool: True if successful, False if session not found
        """
        with self.lock:
            if session_id not in self.sessions:
                return False
            
            self.sessions[session_id]["history"].append({
                "role": role,
                "content": content
            })
            
            self.sessions[session_id]["last_active"] = datetime.now()
            
            return True
    
    def clear_session(self, session_id):
        """
        Clear conversation history for a session.
        
        Args:
            session_id (str): Session ID
        
        Returns:
            bool: True if successful, False if session not found
        """
        with self.lock:
            if session_id not in self.sessions:
                return False
            
            self.sessions[session_id]["history"] = []
            self.sessions[session_id]["last_active"] = datetime.now()
            
            return True
    
    def delete_session(self, session_id):
        """
        Delete a session entirely.
        
        Args:
            session_id (str): Session ID
        
        Returns:
            bool: True if successful, False if session not found
        """
        with self.lock:
            if session_id not in self.sessions:
                return False
            
            del self.sessions[session_id]
            return True
    
    def _cleanup_expired_sessions(self):
        """Remove sessions that have been inactive for too long."""
        now = datetime.now()
        expired = [
            sid for sid, data in self.sessions.items()
            if now - data["last_active"] > self.timeout
        ]
        
        for sid in expired:
            del self.sessions[sid]
    
    def get_active_session_count(self):
        """
        Get number of active sessions.
        
        Returns:
            int: Number of active sessions
        """
        with self.lock:
            self._cleanup_expired_sessions()
            return len(self.sessions)
    
    def session_exists(self, session_id):
        """
        Check if a session exists and is active.
        
        Args:
            session_id (str): Session ID
        
        Returns:
            bool: True if session exists and is active
        """
        with self.lock:
            self._cleanup_expired_sessions()
            return session_id in self.sessions