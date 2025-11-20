"""
Autonomous Task Planner & Executor - Multi-Model LLM Integration
Supports: OpenAI, Groq, Google Generative AI, and Mistral
"""

import os
import json
import logging
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from enum import Enum
from dotenv import load_dotenv
import streamlit as st

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ModelProvider(str, Enum):
    """Supported LLM providers"""
    OPENAI = "openai"
    GROQ = "groq"
    GOOGLE = "google"
    MISTRAL = "mistral"


@dataclass
class ModelConfig:
    """Configuration for an LLM model"""
    provider: ModelProvider
    model_name: str
    api_key: str
    api_url: Optional[str] = None
    temperature: float = 0.7
    max_tokens: int = 2048


class LLMProvider:
    """Base class for LLM providers"""
    
    def __init__(self, config: ModelConfig):
        self.config = config
        self.client = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize the LLM client"""
        raise NotImplementedError
    
    def generate(self, prompt: str, **kwargs) -> str:
        """Generate text from a prompt"""
        raise NotImplementedError
    
    def generate_with_schema(self, prompt: str, schema: Dict[str, Any], **kwargs) -> Dict[str, Any]:
        """Generate structured output with JSON schema"""
        raise NotImplementedError


class OpenAIProvider(LLMProvider):
    """OpenAI API provider"""
    
    def _initialize_client(self):
        """Initialize OpenAI client"""
        try:
            from openai import OpenAI
            self.client = OpenAI(api_key=self.config.api_key)
            logger.info("OpenAI client initialized successfully")
        except ImportError:
            logger.error("OpenAI library not installed. Install with: pip install openai")
            raise
        except Exception as e:
            logger.error(f"Failed to initialize OpenAI client: {e}")
            raise
    
    def generate(self, prompt: str, **kwargs) -> str:
        """Generate text using OpenAI"""
        try:
            response = self.client.chat.completions.create(
                model=self.config.model_name,
                messages=[{"role": "user", "content": prompt}],
                temperature=self.config.temperature,
                max_tokens=self.config.max_tokens,
                **kwargs
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"OpenAI generation failed: {e}")
            raise
    
    def generate_with_schema(self, prompt: str, schema: Dict[str, Any], **kwargs) -> Dict[str, Any]:
        """Generate structured output using OpenAI"""
        try:
            response = self.client.chat.completions.create(
                model=self.config.model_name,
                messages=[{"role": "user", "content": prompt}],
                temperature=self.config.temperature,
                max_tokens=self.config.max_tokens,
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "response",
                        "schema": schema,
                        "strict": True
                    }
                },
                **kwargs
            )
            content = response.choices[0].message.content
            return json.loads(content)
        except Exception as e:
            logger.error(f"OpenAI structured generation failed: {e}")
            raise


class GroqProvider(LLMProvider):
    """Groq API provider"""
    
    def _initialize_client(self):
        """Initialize Groq client"""
        try:
            from groq import Groq
            self.client = Groq(api_key=self.config.api_key)
            logger.info("Groq client initialized successfully")
        except ImportError:
            logger.error("Groq library not installed. Install with: pip install groq")
            raise
        except Exception as e:
            logger.error(f"Failed to initialize Groq client: {e}")
            raise
    
    def generate(self, prompt: str, **kwargs) -> str:
        """Generate text using Groq"""
        try:
            response = self.client.chat.completions.create(
                model=self.config.model_name,
                messages=[{"role": "user", "content": prompt}],
                temperature=self.config.temperature,
                max_tokens=self.config.max_tokens,
                **kwargs
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"Groq generation failed: {e}")
            raise
    
    def generate_with_schema(self, prompt: str, schema: Dict[str, Any], **kwargs) -> Dict[str, Any]:
        """Generate structured output using Groq (JSON mode)"""
        try:
            # Groq supports JSON mode
            response = self.client.chat.completions.create(
                model=self.config.model_name,
                messages=[{"role": "user", "content": prompt}],
                temperature=self.config.temperature,
                max_tokens=self.config.max_tokens,
                response_format={"type": "json_object"},
                **kwargs
            )
            content = response.choices[0].message.content
            return json.loads(content)
        except Exception as e:
            logger.error(f"Groq structured generation failed: {e}")
            raise


class GoogleProvider(LLMProvider):
    """Google Generative AI provider"""
    
    def _initialize_client(self):
        """Initialize Google Generative AI client"""
        try:
            import google.generativeai as genai
            genai.configure(api_key=self.config.api_key)
            self.client = genai.GenerativeModel(self.config.model_name)
            logger.info("Google Generative AI client initialized successfully")
        except ImportError:
            logger.error("Google generativeai library not installed. Install with: pip install google-generativeai")
            raise
        except Exception as e:
            logger.error(f"Failed to initialize Google client: {e}")
            raise
    
    def generate(self, prompt: str, **kwargs) -> str:
        """Generate text using Google Generative AI"""
        try:
            generation_config = {
                "temperature": self.config.temperature,
                "max_output_tokens": self.config.max_tokens,
            }
            response = self.client.generate_content(
                prompt,
                generation_config=generation_config,
                **kwargs
            )
            return response.text
        except Exception as e:
            logger.error(f"Google generation failed: {e}")
            raise
    
    def generate_with_schema(self, prompt: str, schema: Dict[str, Any], **kwargs) -> Dict[str, Any]:
        """Generate structured output using Google (JSON mode)"""
        try:
            # Add JSON schema to prompt
            schema_prompt = f"""{prompt}

Please respond with valid JSON matching this schema:
{json.dumps(schema, indent=2)}"""
            
            generation_config = {
                "temperature": self.config.temperature,
                "max_output_tokens": self.config.max_tokens,
            }
            
            response = self.client.generate_content(
                schema_prompt,
                generation_config=generation_config,
                **kwargs
            )
            return json.loads(response.text)
        except Exception as e:
            logger.error(f"Google structured generation failed: {e}")
            raise


class MistralProvider(LLMProvider):
    """Mistral API provider"""
    
    def _initialize_client(self):
        """Initialize Mistral client"""
        try:
            from mistralai import Mistral
            self.client = Mistral(api_key=self.config.api_key)
            logger.info("Mistral client initialized successfully")
        except ImportError:
            logger.error("Mistral library not installed. Install with: pip install mistralai")
            raise
        except Exception as e:
            logger.error(f"Failed to initialize Mistral client: {e}")
            raise
    
    def generate(self, prompt: str, **kwargs) -> str:
        """Generate text using Mistral"""
        try:
            response = self.client.chat.complete(
                model=self.config.model_name,
                messages=[{"role": "user", "content": prompt}],
                temperature=self.config.temperature,
                max_tokens=self.config.max_tokens,
                **kwargs
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"Mistral generation failed: {e}")
            raise
    
    def generate_with_schema(self, prompt: str, schema: Dict[str, Any], **kwargs) -> Dict[str, Any]:
        """Generate structured output using Mistral (JSON mode)"""
        try:
            schema_prompt = f"""{prompt}

Please respond with valid JSON matching this schema:
{json.dumps(schema, indent=2)}"""
            
            response = self.client.chat.complete(
                model=self.config.model_name,
                messages=[{"role": "user", "content": schema_prompt}],
                temperature=self.config.temperature,
                max_tokens=self.config.max_tokens,
                response_format={"type": "json_object"},
                **kwargs
            )
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            logger.error(f"Mistral structured generation failed: {e}")
            raise


class LLMFactory:
    """Factory for creating LLM providers"""
    
    _providers = {
        ModelProvider.OPENAI: OpenAIProvider,
        ModelProvider.GROQ: GroqProvider,
        ModelProvider.GOOGLE: GoogleProvider,
        ModelProvider.MISTRAL: MistralProvider,
    }
    
    @classmethod
    def create_provider(cls, provider: ModelProvider, config: ModelConfig) -> LLMProvider:
        """Create an LLM provider instance"""
        provider_class = cls._providers.get(provider)
        if not provider_class:
            raise ValueError(f"Unsupported provider: {provider}")
        return provider_class(config)
    
    @classmethod
    def create_from_env(cls, provider: ModelProvider) -> LLMProvider:
        """Create an LLM provider from environment variables"""
        if provider == ModelProvider.OPENAI:
            config = ModelConfig(
                provider=provider,
                model_name=os.getenv("OPENAI_MODEL", "gpt-4o"),
                api_key=os.getenv("OPENAI_API_KEY", ""),
            )
        elif provider == ModelProvider.GROQ:
            config = ModelConfig(
                provider=provider,
                model_name=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
                api_key=os.getenv("GROQ_API_KEY", ""),
            )
        elif provider == ModelProvider.GOOGLE:
            config = ModelConfig(
                provider=provider,
                model_name=os.getenv("GOOGLE_MODEL", "gemini-2.5-flash"),
                api_key=os.getenv("GOOGLE_API_KEY", ""),
            )
        elif provider == ModelProvider.MISTRAL:
            config = ModelConfig(
                provider=provider,
                model_name=os.getenv("MISTRAL_MODEL", "mistral-large-latest"),
                api_key=os.getenv("MISTRAL_API_KEY", ""),
            )
        else:
            raise ValueError(f"Unsupported provider: {provider}")
        
        if not config.api_key:
            raise ValueError(f"API key not found for {provider.value}")
        
        return cls.create_provider(provider, config)


class TaskPlanner:
    """Main task planner using multiple LLM providers"""
    
    def __init__(self, provider: LLMProvider):
        self.provider = provider
    
    def plan_goal(self, goal: str) -> Dict[str, Any]:
        """Generate a task plan for a goal"""
        prompt = f"""You are an expert task planner. Break down the following goal into actionable steps.
For each task, identify the tools needed and dependencies.

Goal: {goal}

Provide a JSON response with this structure:
{{
  "tasks": [
    {{
      "id": "task_1",
      "description": "Task description",
      "tools": ["tool_name"],
      "dependencies": ["task_id_if_any"],
      "optional": false
    }}
  ]
}}"""
        
        schema = {
            "type": "object",
            "properties": {
                "tasks": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string"},
                            "description": {"type": "string"},
                            "tools": {"type": "array", "items": {"type": "string"}},
                            "dependencies": {"type": "array", "items": {"type": "string"}},
                            "optional": {"type": "boolean"}
                        },
                        "required": ["id", "description", "tools", "dependencies"]
                    }
                }
            },
            "required": ["tasks"]
        }
        
        try:
            result = self.provider.generate_with_schema(prompt, schema)
            return result
        except Exception as e:
            logger.warning(f"Structured generation failed, falling back to text: {e}")
            text_response = self.provider.generate(prompt)
            try:
                return json.loads(text_response)
            except json.JSONDecodeError:
                logger.error(f"Failed to parse response as JSON: {text_response}")
                raise
    
    def analyze_results(self, goal: str, results: Dict[str, Any]) -> str:
        """Analyze execution results"""
        prompt = f"""Analyze the following execution results for the goal: {goal}

Results:
{json.dumps(results, indent=2)}

Provide a comprehensive analysis with key insights and recommendations."""
        
        return self.provider.generate(prompt)


def main():
    """Main Streamlit application"""
    st.set_page_config(
        page_title="Multi-Model Task Planner",
        page_icon="🤖",
        layout="wide"
    )
    
    st.title("🤖 Autonomous Task Planner - Multi-Model LLM")
    st.markdown("Break down complex goals using OpenAI, Groq, Google, or Mistral")
    
    # Sidebar configuration
    with st.sidebar:
        st.header("⚙️ Configuration")
        
        # Provider selection
        provider_name = st.selectbox(
            "Select LLM Provider",
            options=[p.value for p in ModelProvider],
            format_func=lambda x: x.upper()
        )
        provider = ModelProvider(provider_name)
        
        # Model selection based on provider (updated with current models)
        model_options = {
            ModelProvider.OPENAI: [
                "gpt-4.1",
                "gpt-4.1-mini",
                "gpt-4.1-nano",
                "gpt-4o",
                "gpt-4o-mini",
                "gpt-4-turbo",
                "gpt-3.5-turbo"
            ],
            ModelProvider.GROQ: [
                "llama-3.3-70b-versatile",
                "llama-3.2-90b-vision-preview",
                "llama-3.2-11b-vision-preview",
                "llama-3.1-70b-versatile",
                "llama-3.1-8b-instant",
                "mixtral-8x7b-32768",
                "gemma2-9b-it",
                "whisper-large-v3"
            ],
            ModelProvider.GOOGLE: [
                "gemini-3-pro",
                "gemini-2.5-flash",
                "gemini-2.5-flash-lite",
                "gemini-2.0-flash",
                "gemini-2.0-flash-lite",
                "gemini-1.5-pro",
                "gemini-1.5-flash"
            ],
            ModelProvider.MISTRAL: [
                "mistral-large-latest",
                "mistral-medium-latest",
                "mistral-small-latest",
                "codestral-latest",
                "ministral-8b-latest",
                "ministral-3b-latest",
                "pixtral-12b-latest"
            ],
        }
        
        model_name = st.selectbox(
            "Select Model",
            options=model_options.get(provider, []),
        )
        
        # API Key input
        api_key = st.text_input(
            f"{provider.value.upper()} API Key",
            type="password",
            value=os.getenv(f"{provider.value.upper()}_API_KEY", "")
        )
        
        # Temperature setting
        temperature = st.slider(
            "Temperature",
            min_value=0.0,
            max_value=2.0,
            value=0.7,
            step=0.1,
            help="Higher values make output more creative"
        )
        
        # Max tokens setting
        max_tokens = st.slider(
            "Max Tokens",
            min_value=256,
            max_value=4096,
            value=2048,
            step=256,
            help="Maximum length of generated response"
        )
    
    # Main content
    col1, col2 = st.columns([0.7, 0.3])
    
    with col1:
        st.header("📋 Task Planning")
        
        goal = st.text_area(
            "Enter your goal:",
            placeholder="e.g., Research the top 5 AI startups funded in 2023 and create a report"
        )
        
        # Generate task plan
        if st.button("Generate Task Plan"):
            if not api_key:
                st.error("Please provide an API key.")
            elif not goal.strip():
                st.error("Please enter a goal.")
            else:
                try:
                    config = ModelConfig(
                        provider=provider,
                        model_name=model_name,
                        api_key=api_key,
                        temperature=temperature,
                        max_tokens=max_tokens
                    )
                    
                    llm_provider = LLMFactory.create_provider(provider, config)
                    planner = TaskPlanner(llm_provider)
                    
                    with st.spinner("Generating task plan..."):
                        plan = planner.plan_goal(goal)
                    
                    st.success("Task plan generated successfully!")
                    st.session_state['plan'] = plan
                    st.session_state['goal'] = goal
                    st.session_state['planner'] = planner
                    
                except Exception as e:
                    st.error(f"Error generating plan: {str(e)}")
        
        # Display plan if available
        if 'plan' in st.session_state:
            st.subheader("📋 Generated Task Plan")
            plan = st.session_state['plan']
            
            for task in plan.get('tasks', []):
                with st.expander(f"{task['id']}: {task['description']}"):
                    st.write(f"**Tools:** {', '.join(task.get('tools', []))}")
                    deps = task.get('dependencies', [])
                    if deps:
                        st.write(f"**Dependencies:** {', '.join(deps)}")
                    st.write(f"**Optional:** {'Yes' if task.get('optional', False) else 'No'}")
    
    with col2:
        st.header("📊 Analysis")
        
        if 'plan' in st.session_state and st.button("Analyze Plan"):
            try:
                analysis = st.session_state['planner'].analyze_results(
                    st.session_state['goal'],
                    st.session_state['plan']
                )
                st.write(analysis)
            except Exception as e:
                st.error(f"Analysis error: {str(e)}")
        else:
            st.info("Generate a task plan first to analyze it.")


if __name__ == "__main__":
    main()