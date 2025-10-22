// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'
import { loadEnvConfig } from '@next/env'

// 在测试环境手动加载本地环境变量（第二个参数为 true，包含 .env.local）
loadEnvConfig(process.cwd(), true)
