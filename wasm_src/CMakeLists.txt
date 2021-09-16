cmake_minimum_required(VERSION 3.0)
project(intonation-practice VERSION 0.0.1)

file(GLOB_RECURSE source_file_list "src/*.cpp" "src/*.cc" "src/*.h")

add_executable(intonation-practice ${source_file_list})

target_compile_features(intonation-practice PRIVATE cxx_std_17)

target_compile_options(intonation-practice PRIVATE
    -DEMSCRIPTEN_HAS_UNBOUND_TYPE_NAMES=0
    -O3
    -g0
    -fno-rtti
    -fno-exceptions
    -flto=full
    -sSTRICT=1
)

target_link_options(intonation-practice PRIVATE
    -O3
    -g0
    -fno-rtti
    -fno-exceptions
    -flto=full
    --no-entry
    --extern-pre-js ${PROJECT_SOURCE_DIR}/preload.js
    --extern-post-js ${PROJECT_SOURCE_DIR}/worker.js
    -sSTRICT=1
    -sENVIRONMENT=worker
    -sEXPORTED_FUNCTIONS=[_malloc,_free,_generateAudio]
    -sMALLOC=emmalloc
    -sALLOW_MEMORY_GROWTH=1
    -sWASM_ASYNC_COMPILATION=0
    -sFILESYSTEM=0
    -sDYNAMIC_EXECUTION=0
)

set_target_properties(intonation-practice PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY ${PROJECT_SOURCE_DIR}/../src/processing
    RUNTIME_OUTPUT_NAME intonation-practice)

add_custom_command(TARGET intonation-practice POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy
                "$<TARGET_PROPERTY:intonation-practice,RUNTIME_OUTPUT_DIRECTORY>/$<TARGET_PROPERTY:intonation-practice,RUNTIME_OUTPUT_NAME>.wasm"
                ${PROJECT_SOURCE_DIR}/../public
    COMMAND ${CMAKE_COMMAND} -E remove
                "$<TARGET_PROPERTY:intonation-practice,RUNTIME_OUTPUT_DIRECTORY>/$<TARGET_PROPERTY:intonation-practice,RUNTIME_OUTPUT_NAME>.wasm"
)