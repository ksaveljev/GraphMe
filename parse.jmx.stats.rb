#!/usr/bin/env ruby
require 'csv'

input = CSV.read("jmx.stats.csv", :headers => true)
output = File.open("data.js", "w")

output.puts("var plotData = new Hash();")

input.headers.each_with_index do |header, index|
  data = []
  input.each do |row|
    data << row[index]
  end
  data.map! do |e|
    begin
      Integer(e)
    rescue
      e
    end
  end
  data.collect!.with_index{ |e, i| [i,e] }.reject!{ |e| e[1] == "ERROR" }
  output.puts("plotData.set('#{header}', #{data.to_s});")
end
